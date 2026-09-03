// admin/src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

function badgeForRole(role: string | null) {
  if (role === 'superadmin') return 'SUPER';
  if (role === 'admin') return 'ADMIN';
  return 'USER';
}

function isProtectedUid(uid: string | undefined, role: string | undefined) {
  if (!uid) return false;
  if (process.env.SUPERADMIN_UID && uid === process.env.SUPERADMIN_UID) return true;
  if (role === 'superadmin') return true;
  return false;
}

function generateUserId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `USR-${code}`;
}

export async function GET(_req: NextRequest) {
  try {
    const caller = await requireAdmin();

    let snap;
    try {
      snap = await adminDb.collection('users').orderBy('createdAt', 'desc').limit(2000).get();
    } catch (e: any) {
      console.error('/api/users Firestore list error:', e);
      if (e?.code === 5 || e?.code === 'NOT_FOUND' || String(e).includes('NOT_FOUND')) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Firestore database not found or Admin credentials incorrect. Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, error: e?.message || String(e) },
        { status: 500 }
      );
    }

    const users = snap.docs.map((doc) => {
      const data = doc.data() as any;
      const role = (data.role as string) || 'user';
      return {
        uid: doc.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        role,
        badge: badgeForRole(role),
        userId: data.userId ?? null,
        protected: isProtectedUid(doc.id, role),
        banned: data.banned === true,
        createdAt: data.createdAt ?? null,
        lastNodeId: data.lastNodeId ?? null,
        lastSeen: data.lastSeen ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      users,
      me: { uid: caller.uid, role: caller.role },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/users GET error', err);
    return NextResponse.json(
      { success: false, error: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const caller = await requireAdmin();
    const callerIsSuper = caller.role === 'superadmin';

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim();
    const password = String(body?.password || '').trim();
    const displayName = body?.displayName ? String(body.displayName).trim() : null;
    const requestedRole = String(body?.role || 'user').trim() || 'user';

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'email and password are required' },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if ((requestedRole === 'admin' || requestedRole === 'superadmin') && !callerIsSuper) {
      return NextResponse.json(
        { success: false, error: 'Only superadmin can create admin accounts' },
        { status: 403 }
      );
    }
    if (requestedRole === 'superadmin') {
      return NextResponse.json(
        { success: false, error: 'Cannot create superadmin via UI' },
        { status: 403 }
      );
    }

    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName: displayName || undefined,
        emailVerified: false,
      });
    } catch (e: any) {
      console.error('admin createUser error', e);
      return NextResponse.json(
        { success: false, error: e?.message || 'Failed to create user' },
        { status: 500 }
      );
    }

    // Set custom claim so the new admin can log into the dashboard
    if (requestedRole === 'admin') {
      try {
        await adminAuth.setCustomUserClaims(userRecord.uid, { admin: true });
      } catch (e) {
        console.warn(e);
      }
    }

    const userId = requestedRole === 'user' ? generateUserId() : null;

    try {
      await adminDb.collection('users').doc(userRecord.uid).set(
        {
          email,
          displayName: displayName || null,
          role: requestedRole,
          userId,
          banned: false,
          createdAt: Date.now(),
          lastNodeId: null,
          lastSeen: null,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Failed to write user doc:', e);
    }

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      email,
      userId,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/users POST error', err);
    return NextResponse.json(
      { success: false, error: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
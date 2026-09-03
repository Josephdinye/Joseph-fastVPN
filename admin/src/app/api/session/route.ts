// admin/src/app/api/session/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from '@/lib/auth';
import { writeSecurityLog } from '@/lib/security-log';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const idToken = String(body?.idToken || '').trim();
    if (!idToken) {
      return NextResponse.json({ success: false, error: 'Missing idToken' }, { status: 400 });
    }

    let decoded: any;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      await writeSecurityLog({
        type: 'admin_login_failed',
        level: 'warn',
        message: 'Invalid or expired ID token',
      });
      return NextResponse.json(
        { success: false, error: 'Invalid or expired ID token' },
        { status: 401 }
      );
    }

    const uid = decoded.uid as string;
    const email = (decoded.email as string) || null;
    const isSuperEnv = !!(process.env.SUPERADMIN_UID && uid === process.env.SUPERADMIN_UID);

    let firestoreRole: string | null = null;
    let banned = false;
    try {
      const userDoc = await adminDb.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const data = userDoc.data() || {};
        firestoreRole = (data.role as string) || null;
        banned = data.banned === true;
      }
    } catch {
      // ignore
    }

    if (banned) {
      await writeSecurityLog({
        type: 'admin_login_denied',
        level: 'warn',
        message: 'Banned account attempted admin login',
        actorUid: uid,
        actorEmail: email,
      });
      return NextResponse.json({ success: false, error: 'Account is banned' }, { status: 403 });
    }

    let role: string | null = null;
    if (isSuperEnv || firestoreRole === 'superadmin') {
      role = 'superadmin';
    } else if (decoded.admin === true || firestoreRole === 'admin') {
      role = 'admin';
    }

    if (role !== 'admin' && role !== 'superadmin') {
      await writeSecurityLog({
        type: 'admin_login_denied',
        level: 'warn',
        message: 'Non-admin attempted admin login',
        actorUid: uid,
        actorEmail: email,
      });
      return NextResponse.json(
        { success: false, error: 'Admin privileges required' },
        { status: 403 }
      );
    }

    try {
      const existing = (await adminAuth.getUser(uid)).customClaims || {};
      await adminAuth.setCustomUserClaims(uid, {
        ...existing,
        admin: true,
        role,
      });
    } catch (e) {
      console.warn('setCustomUserClaims failed (non-fatal)', e);
    }

    const expiresIn = SESSION_MAX_AGE_MS;
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    await writeSecurityLog({
      type: 'admin_login',
      level: 'info',
      message: `Admin signed in (${role})`,
      actorUid: uid,
      actorEmail: email,
      meta: { role },
    });

    const res = NextResponse.json({ success: true, role });
    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(expiresIn / 1000),
    });
    return res;
  } catch (err: any) {
    console.error('/api/auth/session error', err);
    return NextResponse.json(
      { success: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

/** Logout — clear session cookie */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return res;
}
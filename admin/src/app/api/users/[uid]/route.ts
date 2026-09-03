// admin/src/app/api/users/[uid]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { writeSecurityLog } from '@/lib/security-log';

function isProtected(uid: string, role?: string | null) {
  if (process.env.SUPERADMIN_UID && uid === process.env.SUPERADMIN_UID) return true;
  if (role === 'superadmin') return true;
  return false;
}

function generateUserId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `USR-${code}`;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid: targetUid } = await params;

  try {
    const caller = await requireAdmin();
    const callerIsSuper = caller.role === 'superadmin';

    const targetDocSnap = await adminDb.collection('users').doc(targetUid).get();
    const targetData = targetDocSnap.exists ? targetDocSnap.data() || {} : {};
    const targetRole = (targetData.role as string) || 'user';
    const targetEmail = (targetData.email as string) || null;
    const targetIsProtected = isProtected(targetUid, targetRole);

    if (targetIsProtected) {
      return NextResponse.json(
        { success: false, error: 'Cannot modify superadmin account' },
        { status: 403 }
      );
    }
    if (!callerIsSuper && targetRole === 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admins cannot modify other admins' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const updates: Record<string, any> = {};

    if (typeof body.banned === 'boolean') {
      updates.banned = body.banned === true;
      updates.bannedAt = body.banned === true ? Date.now() : null;
    }

    if (typeof body.role === 'string' && body.role !== '') {
      if (!callerIsSuper) {
        return NextResponse.json(
          { success: false, error: 'Only superadmin can change roles' },
          { status: 403 }
        );
      }
      if (body.role === 'superadmin') {
        return NextResponse.json(
          { success: false, error: 'Cannot assign superadmin role via UI' },
          { status: 403 }
        );
      }
      if (!['user', 'admin'].includes(body.role)) {
        return NextResponse.json(
          { success: false, error: 'Invalid role' },
          { status: 400 }
        );
      }

      updates.role = body.role;

      if (body.role === 'user') {
        const existing = targetData.userId;
        if (!existing) updates.userId = generateUserId();
      }
      if (body.role === 'admin') {
        updates.userId = null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    updates.updatedAt = Date.now();
    await adminDb.collection('users').doc(targetUid).set(updates, { merge: true });

    if (updates.banned === true) {
      await adminAuth.revokeRefreshTokens(targetUid).catch(() => {});
      await writeSecurityLog({
        type: 'user_banned',
        level: 'warn',
        message: `User banned${targetEmail ? `: ${targetEmail}` : ''}`,
        actorUid: caller.uid,
        actorEmail: caller.email ?? null,
        targetUid,
        targetEmail,
      });
    }

    if (updates.banned === false) {
      await writeSecurityLog({
        type: 'user_unbanned',
        level: 'info',
        message: `User unbanned${targetEmail ? `: ${targetEmail}` : ''}`,
        actorUid: caller.uid,
        actorEmail: caller.email ?? null,
        targetUid,
        targetEmail,
      });
    }

    if (typeof updates.role === 'string') {
      const isNowAdmin = updates.role === 'admin';
      try {
        const existing = (await adminAuth.getUser(targetUid)).customClaims || {};
        await adminAuth.setCustomUserClaims(targetUid, {
          ...existing,
          admin: isNowAdmin,
          role: updates.role,
        });
      } catch {
        // non-fatal
      }

      await writeSecurityLog({
        type: 'user_role_changed',
        level: 'info',
        message: `Role set to ${updates.role}${targetEmail ? ` for ${targetEmail}` : ''}`,
        actorUid: caller.uid,
        actorEmail: caller.email ?? null,
        targetUid,
        targetEmail,
        meta: { role: updates.role },
      });
    }

    return NextResponse.json({ success: true, uid: targetUid, updates });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const { uid: targetUid } = await params;

  try {
    const caller = await requireAdmin();
    const callerIsSuper = caller.role === 'superadmin';

    if (!callerIsSuper) {
      return NextResponse.json(
        { success: false, error: 'Only superadmin can delete users' },
        { status: 403 }
      );
    }
    if (targetUid === caller.uid) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 403 }
      );
    }

    const targetDocSnap = await adminDb.collection('users').doc(targetUid).get();
    const targetData = targetDocSnap.exists ? targetDocSnap.data() || {} : {};
    const targetRole = (targetData.role as string) || 'user';
    const targetEmail = (targetData.email as string) || null;

    if (isProtected(targetUid, targetRole)) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete superadmin account' },
        { status: 403 }
      );
    }

    try {
      await adminAuth.deleteUser(targetUid);
    } catch (e: any) {
      if (e?.code !== 'auth/user-not-found') {
        return NextResponse.json(
          { success: false, error: e?.message || 'Failed to delete auth user' },
          { status: 500 }
        );
      }
    }

    await adminDb.collection('users').doc(targetUid).delete().catch(() => {});

    await writeSecurityLog({
      type: 'user_deleted',
      level: 'warn',
      message: `User deleted${targetEmail ? `: ${targetEmail}` : ''}`,
      actorUid: caller.uid,
      actorEmail: caller.email ?? null,
      targetUid,
      targetEmail,
    });

    return NextResponse.json({ success: true, uid: targetUid });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
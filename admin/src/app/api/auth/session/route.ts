// admin/src/app/api/auth/session/route.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { adminAuth, adminDb } from '@/lib/firebase-admin';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
} from '@/lib/auth';
import { writeSecurityLog } from '@/lib/security-log';

/**
 * POST /api/auth/session
 *
 * Creates the Firebase admin session cookie.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const idToken = String(body?.idToken || '').trim();

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing idToken',
        },
        { status: 400 }
      );
    }

    /*
     * Verify Firebase ID token.
     */
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
        {
          success: false,
          error: 'Invalid or expired ID token',
        },
        { status: 401 }
      );
    }

    const uid = decoded.uid as string;
    const email = (decoded.email as string) || null;

    /*
     * Check configured superadmin.
     */
    const isSuperEnv =
      !!process.env.SUPERADMIN_UID &&
      uid === process.env.SUPERADMIN_UID;

    /*
     * Check Firestore role and banned status.
     *
     * This happens only during login.
     */
    let firestoreRole: string | null = null;
    let banned = false;

    try {
      const userDoc = await adminDb
        .collection('users')
        .doc(uid)
        .get();

      if (userDoc.exists) {
        const data = userDoc.data() || {};

        firestoreRole =
          typeof data.role === 'string'
            ? data.role
            : null;

        banned = data.banned === true;
      }
    } catch (error) {
      console.warn(
        'Could not read Firestore user record:',
        error
      );

      /*
       * Do not automatically grant a role because Firestore
       * failed. The Firebase token/SUPERADMIN_UID must still
       * authorize the account.
       */
    }

    /*
     * Block banned users.
     */
    if (banned) {
      await writeSecurityLog({
        type: 'admin_login_denied',
        level: 'warn',
        message: 'Banned account attempted admin login',
        actorUid: uid,
        actorEmail: email,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Account is banned',
        },
        { status: 403 }
      );
    }

    /*
     * Determine role.
     */
    let role: string | null = null;

    if (
      isSuperEnv ||
      firestoreRole === 'superadmin'
    ) {
      role = 'superadmin';
    } else if (
      decoded.admin === true ||
      firestoreRole === 'admin'
    ) {
      role = 'admin';
    }

    /*
     * Only admins and superadmins can create
     * an admin session.
     */
    if (
      role !== 'admin' &&
      role !== 'superadmin'
    ) {
      await writeSecurityLog({
        type: 'admin_login_denied',
        level: 'warn',
        message: 'Non-admin attempted admin login',
        actorUid: uid,
        actorEmail: email,
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Admin privileges required',
        },
        { status: 403 }
      );
    }

    /*
     * Keep Firebase custom claims synchronized.
     */
    try {
      const existing =
        (
          await adminAuth.getUser(uid)
        ).customClaims || {};

      await adminAuth.setCustomUserClaims(uid, {
        ...existing,
        admin: true,
        role,
      });
    } catch (error) {
      /*
       * Non-fatal.
       */
      console.warn(
        'setCustomUserClaims failed:',
        error
      );
    }

    /*
     * Create Firebase session cookie.
     */
    const expiresIn = SESSION_MAX_AGE_MS;

    const sessionCookie =
      await adminAuth.createSessionCookie(
        idToken,
        {
          expiresIn,
        }
      );

    /*
     * Log successful login.
     */
    await writeSecurityLog({
      type: 'admin_login',
      level: 'info',
      message: `Admin signed in (${role})`,
      actorUid: uid,
      actorEmail: email,
      meta: {
        role,
      },
    });

    /*
     * Send session cookie to browser.
     */
    const res = NextResponse.json({
      success: true,
      role,
    });

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionCookie,
      httpOnly: true,

      secure:
        process.env.NODE_ENV === 'production',

      sameSite: 'lax',

      path: '/',

      maxAge:
        Math.floor(expiresIn / 1000),
    });

    return res;
  } catch (err: any) {
    console.error(
      '/api/auth/session POST error:',
      err
    );

    return NextResponse.json(
      {
        success: false,
        error:
          err?.message ||
          String(err),
      },
      { status: 500 }
    );
  }
}


/**
 * DELETE /api/auth/session
 *
 * Logs the admin out by:
 *
 * 1. Reading the HTTP-only session cookie
 * 2. Verifying it
 * 3. Revoking Firebase refresh tokens
 * 4. Clearing the session cookie
 */
export async function DELETE(
  req: NextRequest
) {
  let uid: string | null = null;
  let email: string | null = null;

  try {
    /*
     * Read the HTTP-only session cookie.
     */
    const sessionCookie =
      req.cookies.get(
        SESSION_COOKIE_NAME
      )?.value;

    /*
     * If there is no cookie, the browser is
     * effectively already logged out.
     */
    if (!sessionCookie) {
      const res = NextResponse.json({
        success: true,
      });

      res.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,

        secure:
          process.env.NODE_ENV === 'production',

        sameSite: 'lax',

        path: '/',

        maxAge: 0,
      });

      return res;
    }

    /*
     * Verify the session cookie.
     *
     * true = check whether Firebase has revoked
     * the user's refresh tokens.
     */
    try {
      const decoded =
        await adminAuth.verifySessionCookie(
          sessionCookie,
          true
        );

      uid = decoded.uid;

      email =
        (decoded.email as string) ||
        null;
    } catch (error) {
      /*
       * The cookie may already be expired/revoked.
       *
       * Logout should still succeed locally.
       */
      console.warn(
        'Invalid or expired session during logout'
      );
    }

    /*
     * Revoke Firebase refresh tokens.
     *
     * This invalidates existing Firebase refresh
     * tokens for this user.
     */
    if (uid) {
      try {
        await adminAuth.revokeRefreshTokens(
          uid
        );
      } catch (error) {
        console.error(
          'Failed to revoke Firebase refresh tokens:',
          error
        );
      }

      /*
       * Security audit log.
       */
      try {
        await writeSecurityLog({
          type: 'admin_logout',
          level: 'info',
          message: 'Admin signed out',
          actorUid: uid,
          actorEmail: email,
        });
      } catch (error) {
        console.warn(
          'Failed to write logout security log:',
          error
        );
      }
    }

    /*
     * Clear the browser's session cookie.
     */
    const res = NextResponse.json({
      success: true,
    });

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,

      secure:
        process.env.NODE_ENV === 'production',

      sameSite: 'lax',

      path: '/',

      maxAge: 0,
    });

    return res;
  } catch (error) {
    console.error(
      '/api/auth/session DELETE error:',
      error
    );

    /*
     * Even if something goes wrong server-side,
     * remove the browser session cookie.
     */
    const res = NextResponse.json(
      {
        success: true,
      },
      { status: 200 }
    );

    res.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: '',
      httpOnly: true,

      secure:
        process.env.NODE_ENV === 'production',

      sameSite: 'lax',

      path: '/',

      maxAge: 0,
    });

    return res;
  }
}
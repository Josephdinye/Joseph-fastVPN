// admin/src/lib/auth.ts
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from './firebase-admin';

export const SESSION_COOKIE_NAME = 'joseph_fastvpn_session';
export const SESSION_MAX_AGE_MS = parseInt(
  process.env.SESSION_MAX_AGE_MS || String(5 * 24 * 60 * 60 * 1000),
  10
);

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Admin auth — NO Firestore read on every request (saves free-plan quota).
 * Role comes from:
 *  1) custom claim `admin: true`
 *  2) custom claim `role: 'admin' | 'superadmin'`
 *  3) SUPERADMIN_UID env match
 */
export async function requireAdmin() {
  const cookieStore = await cookies();
  const session = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!session) {
    throw new AuthError('Not signed in', 401);
  }

  let decoded: any;
  try {
    decoded = await adminAuth.verifySessionCookie(session, true);
  } catch {
    throw new AuthError('Session expired or invalid — please sign in again', 401);
  }

  const uid = decoded.uid as string;
  const isSuperEnv = !!(process.env.SUPERADMIN_UID && uid === process.env.SUPERADMIN_UID);

  let role: string | null = null;

  if (isSuperEnv || decoded.role === 'superadmin') {
    role = 'superadmin';
  } else if (decoded.admin === true || decoded.role === 'admin') {
    role = 'admin';
  }

  if (role !== 'admin' && role !== 'superadmin') {
    throw new AuthError('Admin privileges required', 403);
  }

  return {
    uid,
    email: (decoded.email as string) ?? null,
    role,
    claims: decoded,
  };
}

/** Native-client auth (Electron/Expo) — Bearer ID token */
export async function requireUser(req: NextRequest) {
  const header = req.headers.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new AuthError('Missing or malformed Authorization header', 401);
  }

  let decoded: any;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    throw new AuthError('Invalid or expired token', 401);
  }

  // Optional ban check — one Firestore read. Comment out if quota is tight.
  try {
    const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    if (userData?.banned === true) {
      throw new AuthError('This account has been suspended', 403);
    }
    return {
      uid: decoded.uid as string,
      email: (decoded.email as string) ?? null,
      claims: decoded,
      userData,
    };
  } catch (e) {
    if (e instanceof AuthError) throw e;
    // If quota is exhausted, still allow authenticated non-banned path
    return {
      uid: decoded.uid as string,
      email: (decoded.email as string) ?? null,
      claims: decoded,
      userData: null,
    };
  }
}
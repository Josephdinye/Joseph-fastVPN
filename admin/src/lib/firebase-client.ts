// admin/src/lib/firebase-client.ts
//
// Browser-side Firebase init for the admin dashboard's login screen only.
// Uses NEXT_PUBLIC_* env vars (safe to ship to the browser). The admin
// dashboard itself does NOT use the resulting ID token directly for
// authenticated requests — see lib/auth.ts: login exchanges this ID token
// once for an httpOnly session cookie via POST /api/auth/session, and
// every admin page/API call after that rides on the cookie automatically.
'use client';

import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

/** Signs in with email/password and exchanges the resulting ID token for an admin session cookie. Throws on bad credentials OR on a successful Firebase login that lacks the admin claim. */
export async function loginAsAdmin(email: string, password: string): Promise<void> {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await cred.user.getIdToken();

  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ idToken }),
  });
  const data = await res.json();

  if (!res.ok || !data.success) {
    // The Firebase sign-in itself succeeded but this account isn't an
    // admin (or the exchange failed) — sign back out so we don't leave a
    // half-authenticated client session lying around.
    await firebaseSignOut(firebaseAuth).catch(() => {});
    throw new Error(data?.error || 'Sign-in failed');
  }
}
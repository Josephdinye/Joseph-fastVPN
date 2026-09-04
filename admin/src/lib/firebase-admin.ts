// admin/src/lib/firebase-admin.ts

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from 'firebase-admin/app';

import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  const existingApps = getApps();

  // Prevent Firebase Admin from being initialized more than once.
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID is not configured.'
    );
  }

  if (!clientEmail) {
    throw new Error(
      'FIREBASE_CLIENT_EMAIL is not configured.'
    );
  }

  if (!privateKey) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY is not configured.'
    );
  }

  // Vercel environment variables can contain literal "\\n".
  // Convert them to real newline characters for the PEM key.
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (
    !privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
    !privateKey.includes('-----END PRIVATE KEY-----')
  ) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY is not a valid PEM private key.'
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export const adminApp = getAdminApp();

export const adminAuth = getAuth(adminApp);

export const adminDb = getFirestore(adminApp);
// admin/src/lib/firebase-admin.ts
//
// Robust Firebase Admin initialization.
// - Prefer: set FIREBASE_SERVICE_ACCOUNT_PATH to a service-account JSON file path.
// - Fallback: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (PEM, newline-escaped).
//
// The module throws on startup with clear guidance when credentials are invalid.
// Keep this file in your repo (permanent).

import fs from 'fs';
import path from 'path';
import { cert, initializeApp, getApps, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function readServiceAccountFromFile(p: string) {
  try {
    const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
    if (!fs.existsSync(abs)) {
      throw new Error(`Service account file not found at ${abs}`);
    }
    const raw = fs.readFileSync(abs, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to read service account file "${p}": ${(e as Error).message}`);
  }
}

function validateEnvCreds(projectId?: string, clientEmail?: string, privateKey?: string) {
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not set');
  if (!clientEmail) throw new Error('FIREBASE_CLIENT_EMAIL is not set');
  if (!privateKey) throw new Error('FIREBASE_PRIVATE_KEY is not set');
  // Ensure privateKey contains PEM markers
  if (!privateKey.includes('BEGIN') || !privateKey.includes('END')) {
    throw new Error('FIREBASE_PRIVATE_KEY does not look like a PEM private key (missing BEGIN/END markers)');
  }
}

function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;

  // If a path to a service account JSON is provided, prefer that (recommended).
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (saPath) {
    const sa = readServiceAccountFromFile(saPath);
    if (!sa.project_id || !sa.client_email || !sa.private_key) {
      throw new Error('Service account JSON missing required fields (project_id, client_email, private_key)');
    }
    return initializeApp({
      credential: cert(sa),
    });
  }

  // Otherwise, use env variables (projectId, clientEmail, privateKey)
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  // Some env setups encode newlines as \n inside the string; unescape them:
  if (typeof privateKey === 'string' && privateKey.includes('\\n')) {
    privateKey = privateKey.replace(/\\n/g, '\n');
  }

  try {
    validateEnvCreds(projectId, clientEmail, privateKey);
  } catch (err) {
    // Augment error message with actionable guidance
    throw new Error(
      `${(err as Error).message}. Recommendation: prefer setting FIREBASE_SERVICE_ACCOUNT_PATH to a JSON file, or ensure FIREBASE_PRIVATE_KEY contains the full PEM (including "-----BEGIN PRIVATE KEY-----" and newline sequences escaped as \\n).`
    );
  }

  // Create cert object for initializeApp
  return initializeApp({
    credential: cert({
      projectId: projectId!,
      clientEmail: clientEmail!,
      privateKey: privateKey!,
    }),
  });
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);
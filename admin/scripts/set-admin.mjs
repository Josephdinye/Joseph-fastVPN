// scripts/make-superadmin.js
//
// Usage:
//   node scripts/make-superadmin.js user@example.com
//   node scripts/make-superadmin.js UID
//
// Loads credentials from .env.local (dotenv) and sets:
//  - custom claim { admin: true } on the Firebase user
//  - Firestore users/<uid> role='superadmin'
//
// Be careful: run this only from a secure machine with access to your Firebase Admin credentials.

const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase Admin credentials. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY are set in .env.local');
  process.exit(1);
}
privateKey = privateKey.replace(/\\n/g, '\n');

const app = getApps().length > 0
  ? getApps()[0]
  : initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

const auth = getAuth(app);
const db = getFirestore(app);

async function findUser(identifier) {
  try {
    if (identifier.includes('@')) {
      return await auth.getUserByEmail(identifier);
    }
    return await auth.getUser(identifier);
  } catch (e) {
    if (e && e.code === 'auth/user-not-found') return null;
    throw e;
  }
}

async function main() {
  const identifier = process.argv[2];
  if (!identifier) {
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/make-superadmin.js EMAIL');
    console.log('or:');
    console.log('  node scripts/make-superadmin.js UID');
    console.log('');
    process.exit(1);
  }

  const user = await findUser(identifier);
  if (!user) {
    console.error('');
    console.error('No Firebase user was found for:', identifier);
    console.error('Make sure the account exists in Firebase Console → Authentication → Users');
    process.exit(1);
  }

  console.log('');
  console.log('User found:');
  console.log('--------------------------------');
  console.log(`Email: ${user.email}`);
  console.log(`UID:   ${user.uid}`);
  console.log('--------------------------------');
  console.log('');

  try {
    const existingClaims = user.customClaims || {};
    // Set admin claim (merge)
    await auth.setCustomUserClaims(user.uid, { ...existingClaims, admin: true });
    // Persist role in Firestore users/<uid>
    await db.collection('users').doc(user.uid).set({
      email: user.email || null,
      displayName: user.displayName || null,
      role: 'superadmin',
      banned: false,
      createdAt: Date.now(),
    }, { merge: true });

    console.log('================================');
    console.log(' SUPERADMIN ROLE ASSIGNED');
    console.log('================================');
    console.log('');
    console.log(`Email: ${user.email}`);
    console.log(`UID:   ${user.uid}`);
    console.log('');
    console.log('admin: true and role: superadmin have been assigned.');
    console.log('');
    console.log('Ask the user to sign out and sign in again to refresh Firebase ID token.');
    console.log('');
  } catch (err) {
    console.error('Failed to assign superadmin role:', err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
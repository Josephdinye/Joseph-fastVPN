import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

function generateUserId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `USR-${code}`;
}

export async function POST() {
  try {
    const caller = await requireAdmin();

    // Optional: only allow superadmin to run sync
    // if (caller.role !== 'superadmin') {
    //   return NextResponse.json({ success: false, error: 'Only superadmin can sync' }, { status: 403 });
    // }

    let nextPageToken: string | undefined;
    let created = 0;
    let skipped = 0;
    let total = 0;

    do {
      const listResult = await adminAuth.listUsers(1000, nextPageToken);
      total += listResult.users.length;

      for (const user of listResult.users) {
        const ref = adminDb.collection('users').doc(user.uid);
        const snap = await ref.get();

        if (snap.exists) {
          skipped++;
          continue;
        }

        // New user → create Firestore doc
        await ref.set(
          {
            email: user.email || null,
            displayName: user.displayName || null,
            role: 'user',
            userId: generateUserId(),
            banned: false,
            createdAt: user.metadata.creationTime
              ? new Date(user.metadata.creationTime).getTime()
              : Date.now(),
            lastNodeId: null,
            lastSeen: null,
          },
          { merge: true }
        );
        created++;
      }

      nextPageToken = listResult.pageToken;
    } while (nextPageToken);

    return NextResponse.json({
      success: true,
      total,
      created,
      skipped,
      message: `Synced ${total} Auth users. Created ${created} new Firestore docs, skipped ${skipped} existing.`,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/users/sync error', err);
    return NextResponse.json(
      { success: false, error: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
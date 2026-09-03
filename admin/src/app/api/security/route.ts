// admin/src/app/api/security/overview/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { getNodeCache } from '@/lib/nodes/cache';

export async function GET() {
  try {
    await requireAdmin();

    // Banned users
    let bannedUsers: any[] = [];
    try {
      const snap = await adminDb
        .collection('users')
        .where('banned', '==', true)
        .limit(200)
        .get();
      bannedUsers = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          uid: doc.id,
          email: d.email ?? null,
          role: d.role ?? 'user',
          userId: d.userId ?? null,
          banned: true,
          updatedAt: d.updatedAt ?? d.bannedAt ?? null,
        };
      });
    } catch (e: any) {
      console.warn('banned users query:', e?.message);
      // Fallback: scan recent users
      const snap = await adminDb.collection('users').limit(500).get();
      bannedUsers = snap.docs
        .map((doc) => {
          const d = doc.data() || {};
          return {
            uid: doc.id,
            email: d.email ?? null,
            role: d.role ?? 'user',
            userId: d.userId ?? null,
            banned: d.banned === true,
            updatedAt: d.updatedAt ?? null,
          };
        })
        .filter((u) => u.banned)
        .slice(0, 200);
    }

    // Banned devices
    let bannedDevices: any[] = [];
    try {
      const snap = await adminDb
        .collection('devices')
        .where('banned', '==', true)
        .limit(200)
        .get();
      bannedDevices = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          deviceId: d.deviceId || doc.id,
          email: d.email ?? null,
          platform: d.platform ?? 'unknown',
          userId: d.userId ?? null,
          lastSeen: d.lastSeen ?? null,
          banned: true,
        };
      });
    } catch (e: any) {
      console.warn('banned devices query:', e?.message);
      const snap = await adminDb.collection('devices').limit(500).get();
      bannedDevices = snap.docs
        .map((doc) => {
          const d = doc.data() || {};
          return {
            id: doc.id,
            deviceId: d.deviceId || doc.id,
            email: d.email ?? null,
            platform: d.platform ?? 'unknown',
            userId: d.userId ?? null,
            lastSeen: d.lastSeen ?? null,
            banned: d.banned === true,
          };
        })
        .filter((d) => d.banned)
        .slice(0, 200);
    }

    const cache = getNodeCache();
    const blockedNodes = cache.nodes.filter((n) => n.enabled === false).length;
    const onlineNodes = cache.nodes.filter((n) => n.status === 'online').length;
    const approvedNodes = cache.nodes.filter((n) => n.securityStatus === 'approved').length;

    return NextResponse.json({
      success: true,
      overview: {
        bannedUsersCount: bannedUsers.length,
        bannedDevicesCount: bannedDevices.length,
        blockedNodesCount: blockedNodes,
        onlineNodes,
        approvedNodes,
        totalNodes: cache.nodes.length,
        nodesTesting: cache.testing,
      },
      bannedUsers,
      bannedDevices,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/security/overview', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
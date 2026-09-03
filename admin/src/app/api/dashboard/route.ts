import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';
import { getNodeCache } from '@/lib/nodes/cache';

async function countCollection(name: string): Promise<number> {
  try {
    const snap = await adminDb.collection(name).count().get();
    return snap.data().count ?? 0;
  } catch {
    try {
      const snap = await adminDb.collection(name).limit(1000).get();
      return snap.size;
    } catch {
      return 0;
    }
  }
}

async function countWhere(name: string, field: string, value: unknown): Promise<number> {
  try {
    const snap = await adminDb.collection(name).where(field, '==', value).count().get();
    return snap.data().count ?? 0;
  } catch {
    try {
      const snap = await adminDb.collection(name).where(field, '==', value).limit(500).get();
      return snap.size;
    } catch {
      try {
        const snap = await adminDb.collection(name).limit(500).get();
        return snap.docs.filter((d) => d.data()?.[field] === value).length;
      } catch {
        return 0;
      }
    }
  }
}

export async function GET() {
  try {
    await requireAdmin();

    const cache = getNodeCache();
    const nodes = cache.nodes || [];
    const onlineNodes = nodes.filter((n) => n.status === 'online').length;
    const blockedNodes = nodes.filter((n) => n.enabled === false).length;
    const approvedNodes = nodes.filter((n) => n.securityStatus === 'approved').length;

    const STALE_MS = 10 * 60 * 1000;
    const now = Date.now();

    // Parallel Firestore reads
    const [
      totalUsers,
      bannedUsers,
      totalDevices,
      bannedDevices,
      securityEvents,
    ] = await Promise.all([
      countCollection('users'),
      countWhere('users', 'banned', true),
      countCollection('devices'),
      countWhere('devices', 'banned', true),
      countCollection('security_logs'),
    ]);

    // Recent + active connections
    let recentConnections: any[] = [];
    let activeConnections = 0;
    try {
      const snap = await adminDb
        .collection('connections')
        .orderBy('lastSeen', 'desc')
        .limit(15)
        .get();
      recentConnections = snap.docs.map((doc) => {
        const d = doc.data() || {};
        let status = d.status === 'active' ? 'active' : 'ended';
        if (status === 'active' && d.lastSeen && now - d.lastSeen > STALE_MS) {
          status = 'ended';
        }
        return {
          id: doc.id,
          email: d.email ?? null,
          platform: d.platform ?? 'unknown',
          nodeName: d.nodeName ?? d.nodeId ?? null,
          status,
          startedAt: d.startedAt ?? null,
          lastSeen: d.lastSeen ?? null,
        };
      });
      activeConnections = recentConnections.filter((c) => c.status === 'active').length;

      // Better active count: query if possible
      try {
        const activeSnap = await adminDb
          .collection('connections')
          .where('status', '==', 'active')
          .limit(200)
          .get();
        activeConnections = activeSnap.docs.filter((doc) => {
          const ls = doc.data()?.lastSeen;
          return !ls || now - ls <= STALE_MS;
        }).length;
      } catch {
        // keep estimate from recent list
      }
    } catch {
      try {
        const snap = await adminDb.collection('connections').limit(30).get();
        recentConnections = snap.docs
          .map((doc) => {
            const d = doc.data() || {};
            return {
              id: doc.id,
              email: d.email ?? null,
              platform: d.platform ?? 'unknown',
              nodeName: d.nodeName ?? d.nodeId ?? null,
              status: d.status === 'active' ? 'active' : 'ended',
              startedAt: d.startedAt ?? null,
              lastSeen: d.lastSeen ?? null,
            };
          })
          .sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0))
          .slice(0, 15);
        activeConnections = recentConnections.filter((c) => c.status === 'active').length;
      } catch {
        recentConnections = [];
      }
    }

    // Online devices (lastSeen within 5 min)
    let onlineDevices = 0;
    try {
      const snap = await adminDb.collection('devices').orderBy('lastSeen', 'desc').limit(200).get();
      onlineDevices = snap.docs.filter((doc) => {
        const ls = doc.data()?.lastSeen;
        return typeof ls === 'number' && now - ls < 5 * 60 * 1000;
      }).length;
    } catch {
      onlineDevices = 0;
    }

    // Firebase health probe
    let firebaseOk = true;
    try {
      await adminDb.collection('settings').doc('global').get();
    } catch {
      firebaseOk = false;
    }

    const nodesOk = nodes.length > 0;
    const nodesStatus = !nodesOk
      ? { label: 'No nodes loaded', warning: true }
      : cache.testing
      ? { label: `Testing… (${onlineNodes} online)`, warning: false }
      : { label: `${onlineNodes} online / ${nodes.length} total`, warning: onlineNodes === 0 };

    return NextResponse.json({
      success: true,
      stats: {
        totalUsers,
        activeConnections,
        totalDevices,
        onlineDevices,
        totalNodes: nodes.length,
        onlineNodes,
        blockedNodes,
        approvedNodes,
        bannedUsers,
        bannedDevices,
        securityEvents,
      },
      system: {
        adminApi: { ok: true, label: 'Operational' },
        firebase: {
          ok: firebaseOk,
          label: firebaseOk ? 'Operational' : 'Error',
        },
        auth: { ok: true, label: 'Operational' },
        nodes: {
          ok: nodesOk && onlineNodes > 0,
          label: nodesStatus.label,
          warning: nodesStatus.warning,
          testing: cache.testing,
          updatedAt: cache.updatedAt,
        },
      },
      recentConnections,
      generatedAt: now,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/dashboard', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
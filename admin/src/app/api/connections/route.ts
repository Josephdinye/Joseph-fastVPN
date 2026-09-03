// admin/src/app/api/connections/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // active | ended | all
    const limit = Math.min(Number(searchParams.get('limit') || 300), 500);

    let connections: any[] = [];

    try {
      let q: FirebaseFirestore.Query = adminDb.collection('connections');
      // Prefer ordered query; may need index
      const snap = await adminDb
        .collection('connections')
        .orderBy('lastSeen', 'desc')
        .limit(limit)
        .get();

      connections = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          userId: d.userId ?? null,
          email: d.email ?? null,
          deviceId: d.deviceId ?? null,
          platform: d.platform ?? 'unknown',
          nodeId: d.nodeId ?? null,
          nodeName: d.nodeName ?? null,
          status: d.status === 'active' ? 'active' : 'ended',
          startedAt: d.startedAt ?? null,
          endedAt: d.endedAt ?? null,
          lastSeen: d.lastSeen ?? null,
        };
      });
    } catch (e: any) {
      console.warn('/api/connections orderBy fallback:', e?.message);
      const snap = await adminDb.collection('connections').limit(limit).get();
      connections = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          userId: d.userId ?? null,
          email: d.email ?? null,
          deviceId: d.deviceId ?? null,
          platform: d.platform ?? 'unknown',
          nodeId: d.nodeId ?? null,
          nodeName: d.nodeName ?? null,
          status: d.status === 'active' ? 'active' : 'ended',
          startedAt: d.startedAt ?? null,
          endedAt: d.endedAt ?? null,
          lastSeen: d.lastSeen ?? null,
        };
      });
      connections.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));
    }

    if (status === 'active' || status === 'ended') {
      connections = connections.filter((c) => c.status === status);
    }

    // Treat stale "active" as offline if no heartbeat for 10 minutes
    const STALE_MS = 10 * 60 * 1000;
    const now = Date.now();
    connections = connections.map((c) => {
      if (
        c.status === 'active' &&
        c.lastSeen &&
        now - c.lastSeen > STALE_MS
      ) {
        return { ...c, status: 'ended', stale: true };
      }
      return { ...c, stale: false };
    });

    const activeCount = connections.filter((c) => c.status === 'active').length;

    return NextResponse.json({
      success: true,
      connections,
      count: connections.length,
      activeCount,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/connections GET', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
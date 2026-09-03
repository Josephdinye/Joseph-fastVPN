// admin/src/app/api/nodes/stats/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getNodeCache } from '@/lib/nodes/cache';

export async function GET() {
  try {
    await requireAdmin();

    const cache = getNodeCache();
    let online = 0;
    let offline = 0;
    let untested = 0;
    let russia = 0;
    let blocked = 0;
    let approved = 0;
    let suspicious = 0;
    let lastRefresh: number | null = null;

    for (const n of cache.nodes) {
      if (n.isRussia) russia++;
      if (n.enabled === false) blocked++;
      if (n.securityStatus === 'approved') approved++;
      if (n.securityStatus === 'suspicious') suspicious++;
      if (n.status === 'online') online++;
      else if (n.status === 'offline') offline++;
      else untested++;
      if (n.lastChecked) {
        const t = Date.parse(n.lastChecked);
        if (!lastRefresh || t > lastRefresh) lastRefresh = t;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: cache.nodes.length,
        online,
        offline,
        untested,
        russia,
        blocked,
        approved,
        suspicious,
        lastRefresh,
        testing: cache.testing,
        cycle: cache.cycle,
        updatedAt: cache.updatedAt,
        error: cache.error,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
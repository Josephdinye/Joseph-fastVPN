// admin/src/app/api/nodes/stats/route.ts - ADMIN STATS ONLY
import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getNodeCache } from '@/lib/nodes/cache';

export async function GET() {
  try {
    await requireAdmin();
    const cache = getNodeCache();

    let online = 0, offline = 0, untested = 0;
    let enabled = 0, blocked = 0;
    let withWarning = 0;
    let lastRefresh: number | null = null;

    for (const n of cache.nodes) {
      // App visibility - ONLY manual block
      if (n.enabled === false) blocked++; else enabled++;

      // Speed test
      if (n.status === 'online') online++;
      else if (n.status === 'offline') offline++;
      else untested++;

      // Security comment only (not app block)
      if (n.securityReasons && n.securityReasons.length > 0) withWarning++;

      if (n.lastChecked) {
        const t = Date.parse(n.lastChecked);
        if (!lastRefresh || t > lastRefresh) lastRefresh = t;
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: cache.nodes.length,
        enabled,      // app gets this
        blocked,      // you blocked manually
        online,       // TCP ping online
        offline,
        untested,
        withWarning,  // has security comment like "Insecure TLS verification"
        lastRefresh,
        testing: cache.testing,
        cycle: cache.cycle,
        updatedAt: cache.updatedAt,
      },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: (err as any)?.message || String(err) }, { status: 500 });
  }
}
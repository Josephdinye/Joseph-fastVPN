// admin/src/app/api/nodes/route.ts - ADMIN DASHBOARD
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getNodeCache } from '@/lib/nodes/cache';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const onlyOnline = searchParams.get('online') === '1';
    const onlyBlocked = searchParams.get('blocked') === '1';
    const limit = Math.min(Number(searchParams.get('limit') || 2000), 5000);

    const cache = getNodeCache();
    let nodes = [...cache.nodes];

    // Filters for UI only - never hide countries by default
    if (onlyOnline) nodes = nodes.filter(n => n.status === 'online');
    if (onlyBlocked) nodes = nodes.filter(n => !n.enabled);

    nodes.sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return (a.latency ?? 99999) - (b.latency ?? 99999);
    });

    nodes = nodes.slice(0, limit);

    return NextResponse.json({
      success: true,
      nodes: nodes.map(n => ({
        id: n.id,
        name: n.name,
        flag: n.flag,
        iso: n.iso,
        subtitle: n.subtitle,
        address: n.address,
        port: n.port,
        status: n.status,
        latency: n.latency,
        securityStatus: n.securityStatus,
        securityScore: n.securityScore,
        securityReasons: n.securityReasons, // Detail column comment only
        enabled: n.enabled !== false,
        raw: n.raw,
      })),
      count: nodes.length,
      totalNodes: cache.nodes.length,
      onlineNodes: cache.nodes.filter(n => n.status === 'online').length,
      enabledNodes: cache.nodes.filter(n => n.enabled).length,
      blockedNodes: cache.nodes.filter(n => !n.enabled).length,
      updatedAt: cache.updatedAt,
      cycle: cache.cycle,
      testing: cache.testing,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: (err as any)?.message || String(err) }, { status: 500 });
  }
}
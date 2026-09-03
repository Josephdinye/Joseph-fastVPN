// admin/src/app/api/nodes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getNodeCache, applyBlocks } from '@/lib/nodes/cache';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const onlyOnline = searchParams.get('online') === '1';
    const excludeRf = searchParams.get('excludeRf') !== '0';
    const onlyEnabled = searchParams.get('enabled') === '1';
    const limit = Math.min(Number(searchParams.get('limit') || 2000), 5000);

    const cache = getNodeCache();
    let nodes = applyBlocks(cache.nodes);

    if (excludeRf) nodes = nodes.filter((n) => !n.isRussia);
    if (onlyOnline) nodes = nodes.filter((n) => n.status === 'online');
    if (onlyEnabled) nodes = nodes.filter((n) => n.enabled !== false);

    nodes = nodes.slice(0, limit);

    return NextResponse.json({
      success: true,
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        flag: n.flag,
        iso: n.iso,
        subtitle: n.subtitle,
        countIndex: n.countIndex,
        isRussia: n.isRussia,
        protocol: n.protocol,
        status: n.status,
        ping: n.latency,
        latency: n.latency,
        score: n.score,
        failReason: n.failReason,
        lastTestedAt: n.lastChecked ? Date.parse(n.lastChecked) : null,
        enabled: n.enabled !== false,
        rawConfig: n.raw,
        host: n.address,
        port: n.port,
        transportSecurity: n.transportSecurity,
        securityStatus: n.securityStatus,
        securityScore: n.securityScore,
        securityReasons: n.securityReasons,
      })),
      count: nodes.length,
      updatedAt: cache.updatedAt,
      cycle: cache.cycle,
      testing: cache.testing,
      totalNodes: cache.nodes.length,
      onlineNodes: cache.nodes.filter((n) => n.status === 'online').length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/nodes GET error', err);
    return NextResponse.json(
      { success: false, error: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
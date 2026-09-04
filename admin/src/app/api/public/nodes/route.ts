// admin/src/app/api/public/nodes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getNodeCache, applyBlocks } from '@/lib/nodes/cache';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractApiKey(req: NextRequest): string | null {
  // 1) ?key=...  (your link style)
  const q = req.nextUrl.searchParams.get('key');
  if (q && q.trim()) return q.trim();

  // 2) Header alternatives
  const headerKey =
    req.headers.get('x-joseph-key') ||
    req.headers.get('x-api-key');
  if (headerKey && headerKey.trim()) return headerKey.trim();

  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    // Your Vercel env name
    const expected = (process.env.NODES_API_KEY || '').trim();
    if (!expected) {
      return NextResponse.json(
        { success: false, error: 'NODES_API_KEY is not configured on the server' },
        { status: 503 }
      );
    }

    const provided = extractApiKey(req);
    if (!provided || provided !== expected) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { searchParams } = new URL(req.url);
    const excludeRf = searchParams.get('excludeRf') !== '0';
    const limit = Math.min(Number(searchParams.get('limit') || 100) || 100, 200);

    const cache = getNodeCache();
    let nodes = applyBlocks(cache.nodes || []);

    nodes = nodes.filter(
      (n) =>
        n.enabled !== false &&
        n.status === 'online' &&
        (n.securityStatus == null || n.securityStatus === 'approved') &&
        !!(n.raw || (n as any).rawConfig)
    );

    if (excludeRf) nodes = nodes.filter((n) => !n.isRussia);

    nodes.sort((a, b) => {
      const sa = a.score ?? 0;
      const sb = b.score ?? 0;
      if (sb !== sa) return sb - sa;
      return (a.latency ?? 99999) - (b.latency ?? 99999);
    });

    nodes = nodes.slice(0, limit);

    return NextResponse.json(
      {
        success: true,
        updatedAt: cache.updatedAt,
        cycle: cache.cycle,
        count: nodes.length,
        generatedAt: Date.now(),
        nodes: nodes.map((n) => ({
          id: n.id,
          name: n.name ?? 'Server',
          flag: n.flag ?? '🌐',
          iso: n.iso ?? null,
          subtitle: n.subtitle ?? null,
          countIndex: n.countIndex ?? null,
          isRussia: n.isRussia === true,
          protocol: n.protocol ?? 'VLESS',
          status: n.status,
          ping: n.latency ?? null,
          score: n.score ?? null,
          rawConfig: n.raw || (n as any).rawConfig || null,
          isAuto: false,
        })),
      },
      {
        headers: {
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch (err: any) {
    console.error('/api/public/nodes error', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Unable to load nodes', nodes: [] },
      { status: 500 }
    );
  }
}
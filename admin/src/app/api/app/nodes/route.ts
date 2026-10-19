// admin/src/app/api/app/nodes/route.ts
import { NextResponse } from 'next/server';
import { getNodeCache, getPublicRawNodes } from '@/lib/nodes/cache';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const apiKey = process.env.APP_NODES_API_KEY;
  
  // MUST have key configured
  if (!apiKey) {
    console.error('[API] APP_NODES_API_KEY not set in .env.local');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const url = new URL(req.url);
  const providedKey = 
    req.headers.get('x-api-key') || 
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    url.searchParams.get('key');

  if (providedKey !== apiKey) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const cache = getNodeCache();
  const rawNodes = getPublicRawNodes();
  const format = url.searchParams.get('format');

  if (format === 'text') {
    return new Response(rawNodes.join('\n'), {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    success: true,
    count: rawNodes.length,
    nodes: rawNodes,
  });
}
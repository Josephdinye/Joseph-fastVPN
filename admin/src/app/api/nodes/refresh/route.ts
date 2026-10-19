// admin/src/app/api/nodes/refresh/route.ts
import { NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { refreshNodes } from '@/lib/nodes/worker';
import { getNodeCache } from '@/lib/nodes/cache';

export async function POST() {
  try {
    await requireAdmin();
    void refreshNodes();

    const cache = getNodeCache();
    return NextResponse.json({
      success: true,
      testing: true,
      cycle: cache.cycle,
      totalNodes: cache.nodes.length,
      enabledNodes: cache.nodes.filter(n => n.enabled).length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: (err as any)?.message || String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const cache = getNodeCache();
    return NextResponse.json({
      success: true,
      testing: cache.testing,
      cycle: cache.cycle,
      totalNodes: cache.nodes.length,
      enabledNodes: cache.nodes.filter(n => n.enabled).length,
      onlineNodes: cache.nodes.filter(n => n.status === 'online').length,
      updatedAt: cache.updatedAt,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: (err as Error).message || String(err) }, { status: 500 });
  }
}
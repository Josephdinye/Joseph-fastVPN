// admin/src/app/api/nodes/[id]/route.ts - Block button for dashboard
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { getNodeCache, setNodeBlocked } from '@/lib/nodes/cache';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const node = getNodeCache().nodes.find((n) => n.id === id);
    if (!node) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, node });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Send { enabled: true|false }' },
        { status: 400 }
      );
    }

    // enabled=false -> blocked from app, enabled=true -> allowed to app
    setNodeBlocked(id, !body.enabled);

    const cache = getNodeCache();
    const node = cache.nodes.find(n => n.id === id);

    return NextResponse.json({
      success: true,
      id,
      enabled: node?.enabled ?? body.enabled,
      totalEnabled: cache.nodes.filter(n => n.enabled).length,
      totalBlocked: cache.nodes.filter(n => !n.enabled).length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
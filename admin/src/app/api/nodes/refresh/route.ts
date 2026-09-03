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
      message: 'Node refresh started (RAM only — no Firebase)',
      testing: true,
      cycle: cache.cycle,
      totalNodes: cache.nodes.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/nodes/refresh error', err);
    return NextResponse.json(
      { success: false, error: (err as any)?.message || String(err) },
      { status: 500 }
    );
  }
}
// admin/src/app/api/public/nodes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUser, AuthError } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);

    const { searchParams } = new URL(req.url);
    const excludeRf = searchParams.get('excludeRf') !== '0';

    const snap = await adminDb.collection('nodes').get();

    let nodes = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name ?? 'Server',
          flag: d.flag ?? '🌐',
          iso: d.iso ?? null,
          subtitle: d.subtitle ?? null,
          countIndex: d.countIndex ?? null,
          protocol: d.protocol ?? 'VLESS',
          ping: d.ping ?? null,
          speedMbps: d.speedMbps ?? null,
          rawConfig: d.rawConfig ?? null,
          _isRussia: d.isRussia === true,
          _enabled: d.enabled !== false,
          _status: d.status ?? 'untested',
        };
      })
      .filter((n) => n._enabled && n._status === 'online' && n.rawConfig);

    if (excludeRf) nodes = nodes.filter((n) => !n._isRussia);

    nodes.sort((a, b) => (a.ping ?? 99999) - (b.ping ?? 99999));

    const publicNodes = nodes.map(({ _isRussia, _enabled, _status, ...rest }) => rest);

    return NextResponse.json(
      { success: true, nodes: publicNodes, count: publicNodes.length, generatedAt: Date.now() },
      { headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } }
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: 'Unable to load nodes' }, { status: 500 });
  }
}
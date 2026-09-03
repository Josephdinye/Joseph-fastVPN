// admin/src/app/api/security-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 200), 500);
    const level = searchParams.get('level'); // info | warn | error
    const type = searchParams.get('type');

    let logs: any[] = [];

    try {
      const snap = await adminDb
        .collection('security_logs')
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .get();

      logs = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          type: d.type || 'unknown',
          level: d.level || 'info',
          message: d.message || '',
          actorUid: d.actorUid ?? null,
          actorEmail: d.actorEmail ?? null,
          targetUid: d.targetUid ?? null,
          targetEmail: d.targetEmail ?? null,
          meta: d.meta ?? null,
          createdAt: d.createdAt ?? null,
        };
      });
    } catch (e: any) {
      console.warn('/api/security-logs orderBy fallback:', e?.message);
      const snap = await adminDb.collection('security_logs').limit(limit).get();
      logs = snap.docs.map((doc) => {
        const d = doc.data() || {};
        return {
          id: doc.id,
          type: d.type || 'unknown',
          level: d.level || 'info',
          message: d.message || '',
          actorUid: d.actorUid ?? null,
          actorEmail: d.actorEmail ?? null,
          targetUid: d.targetUid ?? null,
          targetEmail: d.targetEmail ?? null,
          meta: d.meta ?? null,
          createdAt: d.createdAt ?? null,
        };
      });
      logs.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    }

    if (level) logs = logs.filter((l) => l.level === level);
    if (type) logs = logs.filter((l) => l.type === type);

    return NextResponse.json({
      success: true,
      logs,
      count: logs.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/security-logs GET', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}

/** Optional: admin can clear old logs (superadmin recommended later) */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));
    const olderThanDays = Number(body.olderThanDays || 30);
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const snap = await adminDb
      .collection('security_logs')
      .where('createdAt', '<', cutoff)
      .limit(400)
      .get();

    const batch = adminDb.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    if (!snap.empty) await batch.commit();

    return NextResponse.json({
      success: true,
      deleted: snap.size,
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
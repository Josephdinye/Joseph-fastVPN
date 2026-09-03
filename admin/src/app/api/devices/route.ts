// admin/src/app/api/devices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || 500), 1000);

    let snap;
    try {
      snap = await adminDb
        .collection('devices')
        .orderBy('lastSeen', 'desc')
        .limit(limit)
        .get();
    } catch (e: any) {
      // Missing index or empty — fall back to unordered
      console.warn('/api/devices orderBy lastSeen failed, fallback:', e?.message);
      snap = await adminDb.collection('devices').limit(limit).get();
    }

    const devices = snap.docs.map((doc) => {
      const d = doc.data() || {};
      return {
        id: doc.id,
        deviceId: d.deviceId || doc.id,
        userId: d.userId || null,
        email: d.email ?? null,
        platform: d.platform || 'unknown',
        appName: d.appName ?? null,
        appVersion: d.appVersion ?? null,
        model: d.model ?? null,
        lastSeen: typeof d.lastSeen === 'number' ? d.lastSeen : null,
        lastNodeId: d.lastNodeId ?? null,
        lastNodeName: d.lastNodeName ?? null,
        createdAt: typeof d.createdAt === 'number' ? d.createdAt : null,
        banned: d.banned === true,
      };
    });

    // Sort in memory if fallback path was used
    devices.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

    return NextResponse.json({
      success: true,
      devices,
      count: devices.length,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('/api/devices GET', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}

/**
 * Optional: admin can create a placeholder device row.
 * Real apps should use POST /api/devices/register with a user ID token.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json().catch(() => ({}));

    const deviceId = String(body.deviceId || '').trim();
    const userId = String(body.userId || '').trim();
    if (!deviceId || !userId) {
      return NextResponse.json(
        { success: false, error: 'deviceId and userId required' },
        { status: 400 }
      );
    }

    let email: string | null = body.email ?? null;
    try {
      const user = await adminAuth.getUser(userId);
      email = user.email || email;
    } catch {
      // keep provided email
    }

    const now = Date.now();
    const ref = adminDb.collection('devices').doc(deviceId);
    await ref.set(
      {
        deviceId,
        userId,
        email,
        platform: body.platform || 'unknown',
        appName: body.appName ?? 'Joseph FastVPN',
        appVersion: body.appVersion ?? null,
        model: body.model ?? null,
        lastSeen: now,
        lastNodeId: body.lastNodeId ?? null,
        lastNodeName: body.lastNodeName ?? null,
        createdAt: now,
        banned: false,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: deviceId });
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
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing Bearer token' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Block banned users
    try {
      const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.banned === true) {
        return NextResponse.json({ success: false, error: 'Account banned' }, { status: 403 });
      }
    } catch {
      // non-fatal
    }

    const body = await req.json().catch(() => ({}));
    const deviceId = String(body.deviceId || '').trim();
    if (!deviceId || deviceId.length < 8) {
      return NextResponse.json({ success: false, error: 'Valid deviceId required' }, { status: 400 });
    }

    const platform = String(body.platform || 'unknown').toLowerCase();
    const allowed = new Set(['windows', 'macos', 'linux', 'android', 'ios', 'unknown']);
    const now = Date.now();

    const ref = adminDb.collection('devices').doc(deviceId);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.banned === true) {
      return NextResponse.json({ success: false, error: 'Device banned' }, { status: 403 });
    }

    await ref.set(
      {
        deviceId,
        userId: decoded.uid,
        email: decoded.email || null,
        platform: allowed.has(platform) ? platform : 'unknown',
        appName: body.appName ?? 'Joseph FastVPN',
        appVersion: body.appVersion ?? null,
        model: body.model ?? null,
        lastSeen: now,
        lastNodeId: body.lastNodeId ?? null,
        lastNodeName: body.lastNodeName ?? null,
        createdAt: existing.exists ? existing.data()?.createdAt ?? now : now,
        banned: false,
      },
      { merge: true }
    );

    // Optional: mirror last device activity on user doc
    try {
      await adminDb.collection('users').doc(decoded.uid).set(
        {
          lastSeen: now,
          lastNodeId: body.lastNodeId ?? null,
          lastDeviceId: deviceId,
        },
        { merge: true }
      );
    } catch {
      // non-fatal
    }

    return NextResponse.json({ success: true, deviceId });
  } catch (err) {
    console.error('/api/devices/register', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
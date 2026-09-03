import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

type Action = 'connect' | 'heartbeat' | 'disconnect';

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

    // Banned user?
    try {
      const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
      if (userDoc.exists && userDoc.data()?.banned === true) {
        return NextResponse.json({ success: false, error: 'Account banned' }, { status: 403 });
      }
    } catch {
      // non-fatal
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '').toLowerCase() as Action;
    if (!['connect', 'heartbeat', 'disconnect'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'action must be connect | heartbeat | disconnect' },
        { status: 400 }
      );
    }

    const deviceId = body.deviceId ? String(body.deviceId).trim() : null;
    if (deviceId) {
      try {
        const dev = await adminDb.collection('devices').doc(deviceId).get();
        if (dev.exists && dev.data()?.banned === true) {
          return NextResponse.json({ success: false, error: 'Device banned' }, { status: 403 });
        }
      } catch {
        // non-fatal
      }
    }

    const now = Date.now();
    const platform = String(body.platform || 'unknown').toLowerCase();
    const nodeId = body.nodeId ? String(body.nodeId) : null;
    const nodeName = body.nodeName ? String(body.nodeName) : null;

    // --- connect: new session ---
    if (action === 'connect') {
      // End any other active sessions for this user+device (optional hygiene)
      if (deviceId) {
        try {
          const active = await adminDb
            .collection('connections')
            .where('userId', '==', decoded.uid)
            .where('deviceId', '==', deviceId)
            .where('status', '==', 'active')
            .limit(20)
            .get();
          const batch = adminDb.batch();
          active.docs.forEach((doc) => {
            batch.set(doc.ref, { status: 'ended', endedAt: now, lastSeen: now }, { merge: true });
          });
          if (!active.empty) await batch.commit();
        } catch {
          // index may be missing — skip
        }
      }

      const ref = adminDb.collection('connections').doc();
      await ref.set({
        userId: decoded.uid,
        email: decoded.email || null,
        deviceId,
        platform,
        nodeId,
        nodeName,
        status: 'active',
        startedAt: now,
        endedAt: null,
        lastSeen: now,
      });

      // Mirror on user + device
      try {
        await adminDb.collection('users').doc(decoded.uid).set(
          {
            lastSeen: now,
            lastNodeId: nodeId,
            lastDeviceId: deviceId,
          },
          { merge: true }
        );
      } catch {
        // ignore
      }
      if (deviceId) {
        try {
          await adminDb.collection('devices').doc(deviceId).set(
            {
              lastSeen: now,
              lastNodeId: nodeId,
              lastNodeName: nodeName,
              userId: decoded.uid,
              email: decoded.email || null,
            },
            { merge: true }
          );
        } catch {
          // ignore
        }
      }

      return NextResponse.json({ success: true, connectionId: ref.id, status: 'active' });
    }

    // --- heartbeat / disconnect need connectionId ---
    const connectionId = String(body.connectionId || '').trim();
    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'connectionId required for heartbeat/disconnect' },
        { status: 400 }
      );
    }

    const ref = adminDb.collection('connections').doc(connectionId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ success: false, error: 'Connection not found' }, { status: 404 });
    }
    const data = snap.data() || {};
    if (data.userId !== decoded.uid) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'heartbeat') {
      await ref.set(
        {
          lastSeen: now,
          nodeId: nodeId ?? data.nodeId ?? null,
          nodeName: nodeName ?? data.nodeName ?? null,
          status: 'active',
        },
        { merge: true }
      );
      return NextResponse.json({ success: true, connectionId, status: 'active' });
    }

    // disconnect
    await ref.set(
      {
        status: 'ended',
        endedAt: now,
        lastSeen: now,
        nodeId: nodeId ?? data.nodeId ?? null,
        nodeName: nodeName ?? data.nodeName ?? null,
      },
      { merge: true }
    );
    return NextResponse.json({ success: true, connectionId, status: 'ended' });
  } catch (err) {
    console.error('/api/connections/report', err);
    return NextResponse.json(
      { success: false, error: (err as Error).message || String(err) },
      { status: 500 }
    );
  }
}
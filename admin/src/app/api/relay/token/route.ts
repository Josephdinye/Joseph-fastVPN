// admin/src/app/api/relay/token/route.ts
//
// POST /api/relay/token   body: { nodeId: string }
//
// Mints a short-lived (5 min) JWT scoped to exactly one node's host:port.
// This is the piece that keeps a node server from ever learning who your
// user is: the client never sends its Firebase identity to the VLESS node
// itself (nodes only ever speak VLESS, not your auth system). Instead the
// client:
//   1. Authenticates to *this* backend with its Firebase ID token.
//   2. Gets back a signed, node-scoped, single-purpose relay token here.
//   3. Presents that token to whatever fronts your relay/proxy layer,
//      which checks the signature + `host` claim + expiry before letting
//      the connection through. The node itself still only ever sees
//      "proxy traffic came from relay IP X" — never the user's Firebase
//      uid or account details.
//
// This also gives you central kill-switch control over individual users
// and individual nodes: a banned user's ID token still verifies, but
// requireUser() rejects them before a token is ever minted; a disabled
// node is rejected below even if the client tries to request it directly.
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { requireUser, AuthError } from '@/lib/auth';
import { getAllNodesRaw, getNodesWithStats } from '@/lib/nodes-monitor';
import { extractHostPort } from '@/lib/node-parsers';
import { adminDb } from '@/lib/firebase-admin';

const RELAY_TOKEN_TTL_SECONDS = 5 * 60;

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);

    const body = await req.json().catch(() => ({}));
    const nodeId = body?.nodeId;
    if (!nodeId || typeof nodeId !== 'string') {
      return NextResponse.json({ success: false, error: '"nodeId" is required' }, { status: 400 });
    }

    // Only allow tokens for nodes that are (a) currently enabled and
    // (b) known-online, so a stale/offline node id from a cached client
    // list can't be used to request a token for something the admin has
    // pulled out of rotation.
    const activeIds = new Set(getNodesWithStats({ activeOnly: true }).map((n) => n.id));
    if (!activeIds.has(nodeId)) {
      return NextResponse.json({ success: false, error: 'Node is not currently active' }, { status: 409 });
    }

    const node = getAllNodesRaw().find((n) => n.id === nodeId);
    const hostPort = node ? extractHostPort(node.rawConfig) : null;
    if (!node || !hostPort) {
      return NextResponse.json({ success: false, error: 'Node not found' }, { status: 404 });
    }

    const secret = process.env.RELAY_JWT_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, error: 'Relay signing secret not configured' }, { status: 500 });
    }

    const token = jwt.sign(
      {
        sub: user.uid,
        nodeId: node.id,
        host: hostPort.host,
        port: hostPort.port,
      },
      secret,
      { expiresIn: RELAY_TOKEN_TTL_SECONDS }
    );

    // Best-effort connection log for the admin dashboard / abuse review.
    // Never store the raw vless config or the token itself here.
    adminDb
      .collection('connectionLogs')
      .add({ uid: user.uid, nodeId: node.id, host: hostPort.host, at: Date.now() })
      .catch(() => {});

    return NextResponse.json({
      success: true,
      token,
      host: hostPort.host,
      port: hostPort.port,
      expiresIn: RELAY_TOKEN_TTL_SECONDS,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    return NextResponse.json({ success: false, error: (err as Error).message || 'Could not mint relay token' }, { status: 500 });
  }
}
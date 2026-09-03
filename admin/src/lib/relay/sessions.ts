import crypto from 'crypto';
import { RELAY_POLICY } from './policy';

interface Session {
  id: string;
  userId: string;
  nodeId: string;
  createdAt: number;
  expiresAt: number;
}

const g = globalThis as unknown as { vpnRelaySessions?: Map<string, Session> };
if (!g.vpnRelaySessions) g.vpnRelaySessions = new Map();

export function createSession(userId: string, nodeId: string): Session {
  const id = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const session: Session = {
    id,
    userId,
    nodeId,
    createdAt: now,
    expiresAt: now + RELAY_POLICY.sessionTtlSec * 1000,
  };
  g.vpnRelaySessions!.set(id, session);
  return session;
}

export function getSession(id: string): Session | null {
  const s = g.vpnRelaySessions!.get(id);
  if (!s) return null;
  if (Date.now() > s.expiresAt) {
    g.vpnRelaySessions!.delete(id);
    return null;
  }
  return s;
}

export function countUserSessions(userId: string): number {
  let n = 0;
  for (const s of g.vpnRelaySessions!.values()) {
    if (s.userId === userId && Date.now() <= s.expiresAt) n++;
  }
  return n;
}
// admin/src/lib/relay/firewall.ts
import net from 'net';
import { RELAY_POLICY } from './policy';
import { isNodeAllowed } from '../nodes/firewall';
import { getNodeCache } from '../nodes/cache';

export function assertUpstreamNodeAllowed(
  nodeId: string
): { ok: true } | { ok: false; reason: string } {
  const node = getNodeCache().nodes.find((n) => n.id === nodeId);
  if (!node) return { ok: false, reason: 'Unknown upstream' };
  if (!isNodeAllowed(node)) return { ok: false, reason: 'Upstream not approved' };
  return { ok: true };
}

export function isForbiddenResolvedIp(ip: string): boolean {
  if (net.isIP(ip) === 0) return true;
  if (ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip === '::1') return true;
  // IPv4-mapped / link-local style
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Client must NEVER send arbitrary vless:// to the relay.
 * Only nodeId chosen from your approved list.
 */
export function authorizeRelayConnect(input: {
  userId: string;
  nodeId: string;
  sessionsForUser: number;
}): { allow: true } | { allow: false; reason: string } {
  if (!input.userId) return { allow: false, reason: 'Unauthenticated' };

  if (input.sessionsForUser >= RELAY_POLICY.maxSessionsPerUser) {
    return { allow: false, reason: 'Session limit' };
  }

  const up = assertUpstreamNodeAllowed(input.nodeId);
  if (!up.ok) return { allow: false, reason: up.reason };

  return { allow: true };
}
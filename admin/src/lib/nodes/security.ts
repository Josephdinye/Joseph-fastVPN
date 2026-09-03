import net from 'net';
import type { VPNNode } from './cache';

export interface SecurityResult {
  status: 'pending' | 'approved' | 'suspicious' | 'blocked';
  score: number;
  reasons: string[];
}

const BLOCKED_HOST_PARTS = ['localhost', 'metadata.google', '169.254.169.254'];

function isPrivateOrForbiddenIp(ip: string): boolean {
  if (net.isIP(ip) === 0) return false;
  const p = ip.split('.').map(Number);
  if (p.length === 4) {
    if (p[0] === 10 || p[0] === 127 || p[0] === 0) return true;
    if (p[0] === 169 && p[1] === 254) return true;
    if (p[0] === 192 && p[1] === 168) return true;
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
  }
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) {
    return true;
  }
  return false;
}

export function inspectNode(node: VPNNode): SecurityResult {
  const reasons: string[] = [];
  let score = 100;

  if (!node.address) {
    return { status: 'blocked', score: 0, reasons: ['Missing address'] };
  }

  const hostLower = node.address.toLowerCase();
  for (const bad of BLOCKED_HOST_PARTS) {
    if (hostLower.includes(bad)) {
      return { status: 'blocked', score: 0, reasons: [`Forbidden host: ${bad}`] };
    }
  }

  if (net.isIP(node.address) && isPrivateOrForbiddenIp(node.address)) {
    return { status: 'blocked', score: 0, reasons: ['Private/metadata IP forbidden'] };
  }

  if (node.allowInsecure) {
    score -= 100;
    reasons.push('Insecure TLS verification');
  }

  if (node.transportSecurity === 'none' || node.transportSecurity === 'unknown') {
    score -= 100;
    reasons.push('No REALITY/TLS transport security');
  } else if (node.transportSecurity === 'tls') {
    score -= 5;
  }

  if (node.transportSecurity === 'reality' && !node.hasRealityKey) {
    score -= 80;
    reasons.push('REALITY without public key');
  }

  if (score <= 0) return { status: 'blocked', score: 0, reasons };
  if (score < 80) return { status: 'suspicious', score, reasons };
  return { status: 'approved', score, reasons };
}
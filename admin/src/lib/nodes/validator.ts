import type { VPNNode } from './cache';

export interface ValidateResult {
  valid: boolean;
  reasons: string[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ALLOWED_SECURITY = new Set(['reality', 'tls']);
const ALLOWED_TRANSPORT = new Set(['tcp', 'raw', 'xhttp', 'grpc', 'ws', 'http']);
const ALLOWED_FLOW = new Set(['', 'xtls-rprx-vision', 'xtls-rprx-vision-udp443']);

export function validateNode(node: VPNNode): ValidateResult {
  const reasons: string[] = [];

  if (node.protocol !== 'vless') reasons.push('Only VLESS allowed');
  if (!node.raw.startsWith('vless://')) reasons.push('Invalid scheme');

  try {
    const url = new URL(node.raw);
    if (!UUID_RE.test(url.username || '')) reasons.push('Invalid UUID');
    if (!node.address || node.address.length < 3) reasons.push('Invalid address');
    if (!Number.isInteger(node.port) || node.port < 1 || node.port > 65535) {
      reasons.push('Invalid port');
    }

    const security = (url.searchParams.get('security') || 'none').toLowerCase();
    if (!ALLOWED_SECURITY.has(security)) {
      reasons.push(`Security not allowed: ${security}`);
    }

    if (security === 'reality') {
      const pbk = url.searchParams.get('pbk') || '';
      if (pbk.length < 20) reasons.push('REALITY missing/invalid pbk');
    }

    if (security === 'tls') {
      const sni = url.searchParams.get('sni') || url.searchParams.get('host') || '';
      if (!sni) reasons.push('TLS missing SNI');
    }

    const type = (url.searchParams.get('type') || 'tcp').toLowerCase();
    if (!ALLOWED_TRANSPORT.has(type)) reasons.push(`Transport not allowed: ${type}`);

    const flow = (url.searchParams.get('flow') || '').toLowerCase();
    if (!ALLOWED_FLOW.has(flow)) reasons.push(`Flow not allowed: ${flow}`);

    if (url.searchParams.get('allowInsecure') === '1') {
      reasons.push('allowInsecure=1 forbidden');
    }
  } catch {
    reasons.push('Malformed VLESS URI');
  }

  return { valid: reasons.length === 0, reasons };
}
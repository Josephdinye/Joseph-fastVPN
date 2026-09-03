import crypto from 'crypto';

/** Stable id: ignore display name / remark */
export function fingerprintVless(raw: string): string {
  try {
    const url = new URL(raw);
    const uuid = url.username || '';
    const host = (url.hostname || '').toLowerCase();
    const port = url.port || '443';
    const security = (url.searchParams.get('security') || 'none').toLowerCase();
    const type = (url.searchParams.get('type') || 'tcp').toLowerCase();
    const sni = (url.searchParams.get('sni') || url.searchParams.get('host') || '').toLowerCase();
    const pbk = url.searchParams.get('pbk') || '';
    const sid = url.searchParams.get('sid') || '';
    const flow = url.searchParams.get('flow') || '';
    const path = url.searchParams.get('path') || '';
    const serviceName = url.searchParams.get('serviceName') || '';

    const canonical = [
      uuid,
      host,
      port,
      security,
      type,
      sni,
      pbk,
      sid,
      flow,
      path,
      serviceName,
    ].join('|');

    return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 16);
  } catch {
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }
}
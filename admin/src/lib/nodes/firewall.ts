// admin/src/lib/nodes/firewall.ts  (fix typo: was firewalll.ts)

import type { VPNNode } from './cache';

// For APP FRONTEND - ONLY check if you blocked it manually
// NO status, NO securityScore, NO reliability check
export function isNodeAllowed(node: VPNNode): boolean {
  if (!node.enabled) return false; // you blocked it in dashboard
  return true; // send everything else same as GitHub raw
}

export function filterSafeNodes(nodes: VPNNode[]): VPNNode[] {
  return nodes.filter(isNodeAllowed);
}

// For ADMIN DASHBOARD - show raw + speed but sanitize for client
// App gets raw vless:// string, not this object
export function sanitizeNodeForClient(node: VPNNode) {
  return {
    id: node.id,
    name: node.name,
    flag: node.flag,
    iso: node.iso,
    subtitle: node.subtitle,
    status: node.status, // for dashboard only
    latency: node.latency, // for dashboard only
    speedMbps: node.speedMbps, // for dashboard only
    score: node.score,
    enabled: node.enabled, // for block toggle
    raw: node.raw, // app needs this
  };
}

// Separate function for your admin dashboard if you want to show "Safe" badge
// This is ONLY for UI, not for filtering app nodes
export function isNodeSafeForBadge(node: VPNNode): boolean {
  if (node.securityStatus === 'blocked') return false;
  if (node.securityScore < 50) return false;
  return true;
}
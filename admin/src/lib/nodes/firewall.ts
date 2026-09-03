import type { VPNNode } from './cache';
import { NODE_POLICY } from './policy';
import { reliabilityScore } from './reputation';

export function isNodeAllowed(node: VPNNode): boolean {
  if (!node.enabled) return false;
  if (node.status !== 'online') return false;
  if (node.securityStatus !== 'approved') return false;
  if (node.securityScore < NODE_POLICY.minSecurityScore) return false;
  if (reliabilityScore(node.id) < NODE_POLICY.minReliabilityForSafeList) return false;
  return true;
}

export function filterSafeNodes(nodes: VPNNode[]): VPNNode[] {
  return nodes.filter(isNodeAllowed);
}

/** Client-facing fields — no raw upstream by default */
export function sanitizeNodeForClient(node: VPNNode) {
  return {
    id: node.id,
    name: node.name,
    flag: node.flag,
    iso: node.iso,
    subtitle: node.subtitle,
    status: node.status,
    latency: node.latency,
    score: node.score,
  };
}
// admin/src/lib/nodes/ranker.ts
import type { VPNNode } from './cache';
import { reliabilityScore } from './reputation';

// Score is ONLY for Admin Dashboard UI - to sort by fastest
// It does NOT affect what goes to the app
export function calculateScore(node: VPNNode): number {
  // Don't return 0 if offline - keep it visible in admin but with low score
  let reliability = 50;
  try {
    reliability = reliabilityScore(node.id);
  } catch {
    reliability = 50;
  }

  let latencyScore = 50; // default if not tested yet
  if (node.latency != null) {
    if (node.latency <= 50) latencyScore = 100;
    else if (node.latency <= 80) latencyScore = 90;
    else if (node.latency <= 120) latencyScore = 80;
    else if (node.latency <= 180) latencyScore = 65;
    else if (node.latency <= 250) latencyScore = 50;
    else latencyScore = 25;
  } else {
    // Not tested yet = middle score, so it still shows in admin
    latencyScore = 60;
  }

  const protocolScore =
    node.transportSecurity === 'reality' ? 100 : node.transportSecurity === 'tls' ? 80 : 50;
  
  const securityScore = node.securityScore || 50;
  const stability = node.failReason ? 40 : 100;

  // If offline, penalize but don't zero it - you still want to see it in dashboard
  const onlineMultiplier = node.status === 'offline' ? 0.3 : node.status === 'unknown' ? 0.8 : 1;

  return Math.round(
    (reliability * 0.4 +
      latencyScore * 0.25 +
      protocolScore * 0.15 +
      stability * 0.1 +
      securityScore * 0.1) * onlineMultiplier
  );
}

// For ADMIN DASHBOARD - sort by score/latency for display
export function rankNodes(nodes: VPNNode[]): VPNNode[] {
  return nodes
    .map((node) => ({ ...node, score: calculateScore(node) }))
    .sort((a, b) => {
      // Blocked nodes always at bottom in admin
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return (a.latency ?? Infinity) - (b.latency ?? Infinity);
    });
}

// For APP FRONTEND - NO ranking, same order as GitHub raw
export function getAppNodesInOriginalOrder(nodes: VPNNode[]): VPNNode[] {
  return nodes.filter(n => n.enabled); // only filter blocked, keep GitHub order
}
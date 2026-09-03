// admin/src/lib/nodes/ranker.ts
import type { VPNNode } from './cache';
import { reliabilityScore } from './reputation';

export function calculateScore(node: VPNNode): number {
  if (node.status !== 'online') return 0;

  const reliability = reliabilityScore(node.id);
  let latencyScore = 0;
  if (node.latency != null) {
    if (node.latency <= 50) latencyScore = 100;
    else if (node.latency <= 80) latencyScore = 90;
    else if (node.latency <= 120) latencyScore = 80;
    else if (node.latency <= 180) latencyScore = 65;
    else if (node.latency <= 250) latencyScore = 50;
    else latencyScore = 25;
  }

  const protocolScore =
    node.transportSecurity === 'reality' ? 100 : node.transportSecurity === 'tls' ? 80 : 0;
  const securityScore = node.securityScore;
  const stability = node.failReason ? 80 : 100;

  return Math.round(
    reliability * 0.4 +
      latencyScore * 0.25 +
      protocolScore * 0.15 +
      stability * 0.1 +
      securityScore * 0.1
  );
}

export function rankNodes(nodes: VPNNode[]): VPNNode[] {
  return nodes
    .map((node) => ({ ...node, score: calculateScore(node) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.latency ?? Infinity) - (b.latency ?? Infinity);
    });
}
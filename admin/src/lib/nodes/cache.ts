// admin/src/lib/nodes/cache.ts
export type NodeStatus = 'unknown' | 'testing' | 'online' | 'offline' | 'degraded';
export type NodeSecurityStatus = 'pending' | 'approved' | 'suspicious' | 'blocked';

export interface VPNNode {
  id: string;
  fingerprint: string;
  protocol: 'vless';
  address: string;
  port: number;
  name: string;
  flag: string;
  iso: string | null;
  subtitle: string;
  countIndex: number;
  isRussia: boolean;
  raw: string;

  transportSecurity: 'reality' | 'tls' | 'none' | 'unknown';
  transport: string;
  flow: string | null;
  sni: string | null;
  hasRealityKey: boolean;
  allowInsecure: boolean;

  status: NodeStatus;
  latency: number | null;
  speedMbps: number | null;
  score: number;
  enabled: boolean;
  failReason: string | null;
  lastChecked: string | null;

  securityStatus: NodeSecurityStatus;
  securityScore: number;
  securityReasons: string[];
}

interface NodeCache {
  nodes: VPNNode[];
  updatedAt: string | null;
  cycle: number;
  testing: boolean;
  error: string | null;
}

const globalForNodes = globalThis as unknown as {
  vpnNodeCache?: NodeCache;
  vpnBlockedIds?: Set<string>;
};

if (!globalForNodes.vpnNodeCache) {
  globalForNodes.vpnNodeCache = {
    nodes: [],
    updatedAt: null,
    cycle: 0,
    testing: false,
    error: null,
  };
}

if (!globalForNodes.vpnBlockedIds) {
  globalForNodes.vpnBlockedIds = new Set();
}

export function getNodeCache(): NodeCache {
  return globalForNodes.vpnNodeCache!;
}

export function setNodeCache(nodes: VPNNode[]) {
  const cache = getNodeCache();
  cache.nodes = nodes;
  cache.updatedAt = new Date().toISOString();
  cache.cycle += 1;
  cache.error = null;
}

export function setNodeTesting(testing: boolean) {
  getNodeCache().testing = testing;
}

export function setNodeError(msg: string | null) {
  getNodeCache().error = msg;
}

export function setNodeBlocked(id: string, blocked: boolean) {
  const set = globalForNodes.vpnBlockedIds!;
  if (blocked) set.add(id);
  else set.delete(id);
  const n = getNodeCache().nodes.find((x) => x.id === id);
  if (n) n.enabled = !blocked;
}

export function isNodeBlocked(id: string): boolean {
  return globalForNodes.vpnBlockedIds!.has(id);
}

export function applyBlocks(nodes: VPNNode[]): VPNNode[] {
  return nodes.map((n) => ({
    ...n,
    enabled: !isNodeBlocked(n.id) && n.enabled !== false,
  }));
}
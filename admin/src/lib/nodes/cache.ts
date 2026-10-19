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
  // Preserve blocked state when refreshing from GitHub
  const blocked = globalForNodes.vpnBlockedIds!;
  cache.nodes = nodes.map(n => ({
    ...n,
    enabled: !blocked.has(n.id) && n.enabled !== false
  }));
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

// For ADMIN DASHBOARD - returns ALL nodes, including blocked (so you can see & unblock)
export function getAdminNodes(): VPNNode[] {
  const cache = getNodeCache();
  return cache.nodes.map(n => ({
    ...n,
    enabled: !isNodeBlocked(n.id) && n.enabled !== false
  }));
}

// For FRONTEND APP - returns ONLY enabled nodes as raw strings, same as GitHub raw
export function applyBlocks(nodes: VPNNode[]): VPNNode[] {
  return nodes.filter(n => !isNodeBlocked(n.id) && n.enabled !== false);
}

export function getPublicRawNodes(): string[] {
  return applyBlocks(getNodeCache().nodes).map(n => n.raw);
}

// Auto-refresh from GitHub raw if cache is empty
export async function refreshCacheIfEmpty(): Promise<NodeCache> {
  const cache = getNodeCache();
  if (cache.nodes.length > 0) return cache;

  try {
    const { downloadNodeFeed } = await import('./feed');
    const { parseVlessNodes } = await import('./parser'); // your parser.ts should export this
    
    const rawText = await downloadNodeFeed();
    const parsed = parseVlessNodes(rawText); // returns VPNNode[]
    
    setNodeCache(parsed);
    return getNodeCache();
  } catch (e: any) {
    setNodeError(e.message || String(e));
    return cache;
  }
}

// For speed test - updates latency/speed but NEVER changes enabled
export function updateNodeTestResult(id: string, result: Partial<VPNNode>) {
  const node = getNodeCache().nodes.find(n => n.id === id);
  if (node) {
    node.status = result.status || node.status;
    node.latency = result.latency ?? node.latency;
    node.speedMbps = result.speedMbps ?? node.speedMbps;
    node.lastChecked = new Date().toISOString();
    node.failReason = result.failReason ?? null;
    // IMPORTANT: we do NOT touch enabled here
  }
}
// admin/src/lib/nodes/worker.ts - WEB VERSION - NO XRAY BINARY
import { downloadNodeFeed } from './feed';
import { parseVlessNodes } from './parser';
import { inspectNode } from './security';
import type { VPNNode } from './cache';
import { getNodeCache, setNodeCache, setNodeTesting, setNodeError, isNodeBlocked, updateNodeTestResult } from './cache';
import net from 'net';

const TIMEOUT = Number(process.env.NODE_TEST_TIMEOUT || 5000);

function tcpPing(host: string, port: number): Promise<{ online: boolean, latency: number }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let done = false;
    const finish = (online: boolean) => {
      if (done) return;
      done = true;
      const latency = Date.now() - start;
      try { socket.destroy(); } catch {}
      resolve({ online, latency });
    };
    socket.setTimeout(TIMEOUT);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
    try { socket.connect(port, host); } catch { finish(false); }
  });
}

export async function refreshNodes() {
  setNodeTesting(true);
  try {
    const raw = await downloadNodeFeed();
    const parsed = parseVlessNodes(raw) as unknown as VPNNode[];

    // Security badge for dashboard only
    const enriched = parsed.map(n => {
      const sec = inspectNode(n as any);
      return { ...n, securityStatus: sec.status, securityScore: sec.score, securityReasons: sec.reasons };
    });

    // Preserve manual blocks from this cache.ts
    const finalNodes = enriched.map(n => ({
      ...n,
      enabled: !isNodeBlocked(n.id) && (n as any).enabled !== false
    }));

    setNodeCache(finalNodes as any);
    console.log(`[Nodes] Published ${finalNodes.length} nodes for app (same as GitHub minus ${finalNodes.filter(n=>!n.enabled).length} blocked)`);

    // Background TCP test for dashboard only - works on Vercel/web
    const concurrency = 50;
    for (let i = 0; i < finalNodes.length; i += concurrency) {
      const batch = finalNodes.slice(i, i + concurrency);
      const results = await Promise.all(batch.map(async (n) => {
        const { online, latency } = await tcpPing(n.address, n.port);
        return { id: n.id, status: online ? 'online' as const : 'offline' as const, latency: online ? latency : null, failReason: online ? null : `TCP ${n.address}:${n.port} unreachable` };
      }));
      results.forEach(r => updateNodeTestResult(r.id, { status: r.status, latency: r.latency, failReason: r.failReason } as any));
    }

    const cache = getNodeCache();
    console.log(`[Nodes] Cycle ${cache.cycle}: ${cache.nodes.filter(n=>n.status==='online').length} online / ${cache.nodes.length} total`);

  } catch (e: any) {
    console.error('[Nodes] refresh failed', e);
    setNodeError(e.message);
  } finally {
    setNodeTesting(false);
  }
}

export function startNodeWorker() {
  void refreshNodes();
  const interval = Number(process.env.NODE_TEST_INTERVAL || 300000);
  setInterval(() => void refreshNodes(), interval);
  console.log(`[Nodes] Worker scheduled every ${interval/1000}s`);
}
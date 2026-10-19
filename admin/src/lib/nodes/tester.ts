// admin/src/lib/nodes/tester.ts - WEB VERSION - NO XRAY BINARY NEEDED
import net from 'net';
import type { VPNNode } from './types';

const TIMEOUT = Number(process.env.NODE_TEST_TIMEOUT || 5000);

function tcpPing(host: string, port: number, timeout = TIMEOUT): Promise<{ online: boolean, latency: number }> {
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

    socket.setTimeout(timeout);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));
    
    try {
      socket.connect(port, host);
    } catch {
      finish(false);
    }
  });
}

export async function testNode(node: VPNNode): Promise<VPNNode> {
  try {
    // Just check if host:port is open - works on Vercel, no binary
    const { online, latency } = await tcpPing(node.address, node.port);

    return {
      ...node,
      status: online ? 'online' : 'offline',
      latency: online ? latency : null,
      failReason: online ? null : `TCP ${node.address}:${node.port} unreachable`,
      lastChecked: new Date().toISOString(),
      enabled: node.enabled, // preserve manual block
    };
  } catch (e: any) {
    return {
      ...node,
      status: 'offline',
      latency: null,
      failReason: e.message,
      lastChecked: new Date().toISOString(),
      enabled: node.enabled,
    };
  }
}

// Batch tester for worker.ts
export async function testNodesBatch(nodes: VPNNode[], concurrency = 50): Promise<VPNNode[]> {
  const results: VPNNode[] = [];
  for (let i = 0; i < nodes.length; i += concurrency) {
    const batch = nodes.slice(i, i + concurrency);
    const tested = await Promise.all(batch.map(testNode));
    results.push(...tested);
  }
  return results;
}
// admin/src/lib/nodes/tester.ts
import net from 'net';
import type { VPNNode } from './cache';

/** Real online check only. speedMbps stays null (no fake formula). */
function tcpProbe(node: VPNNode, timeoutMs: number): Promise<VPNNode> {
  return new Promise((resolve) => {
    if (!node.address || !node.port) {
      return resolve({
        ...node,
        status: 'offline',
        latency: null,
        speedMbps: null,
        failReason: 'Missing host/port',
        lastChecked: new Date().toISOString(),
      });
    }

    const started = Date.now();
    const socket = net.connect({ host: node.address, port: node.port, family: 4 });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({
        ...node,
        status: 'offline',
        latency: null,
        speedMbps: null,
        failReason: 'Timeout',
        lastChecked: new Date().toISOString(),
      });
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timer);
      const latency = Date.now() - started;
      socket.end();
      resolve({
        ...node,
        status: 'online',
        latency,
        speedMbps: null,
        failReason: null,
        lastChecked: new Date().toISOString(),
      });
    });

    socket.once('error', (err) => {
      clearTimeout(timer);
      resolve({
        ...node,
        status: 'offline',
        latency: null,
        speedMbps: null,
        failReason: err.message,
        lastChecked: new Date().toISOString(),
      });
    });
  });
}

export async function testNode(node: VPNNode): Promise<VPNNode> {
  const timeout = Number(process.env.NODE_TEST_TIMEOUT || 2000);
  return tcpProbe(node, timeout);
}
// admin/src/lib/nodes/tester.ts
import net from 'net';
import http from 'http';
import https from 'https';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { VPNNode } from './cache';

const XRAY_PATH = process.env.XRAY_BIN_PATH || path.join(process.cwd(), 'bin', 'xray'); // Linux binary, NOT xray.exe

function buildXrayConfig(rawUrl: string, localPort: number) {
  const url = new URL(rawUrl);
  const uuid = url.username;
  const address = url.hostname;
  const port = parseInt(url.port);
  const sp = url.searchParams;

  return {
    log: { loglevel: 'warning' },
    inbounds: [{ port: localPort, protocol: 'http', settings: { auth: 'noauth', udp: true } }],
    outbounds: [{
      protocol: 'vless',
      settings: { vnext: [{ address, port, users: [{ id: uuid, encryption: 'none', flow: sp.get('flow') || undefined }] }] },
      streamSettings: {
        network: sp.get('type') || 'tcp',
        security: sp.get('security') || 'none',
        realitySettings: sp.get('security') === 'reality' ? {
          show: false,
          fingerprint: sp.get('fp') || 'chrome',
          serverName: sp.get('sni') || '',
          publicKey: sp.get('pbk') || '',
          shortId: sp.get('sid') || '',
        } : undefined,
        tlsSettings: sp.get('security') === 'tls' ? {
          serverName: sp.get('sni') || '',
          fingerprint: sp.get('fp') || 'chrome',
        } : undefined,
        wsSettings: sp.get('type') === 'ws' ? {
          path: sp.get('path') || '/',
          headers: sp.get('host') ? { Host: sp.get('host')! } : undefined,
        } : undefined,
        grpcSettings: sp.get('type') === 'grpc' ? { serviceName: sp.get('serviceName') || '' } : undefined,
      },
    }],
  };
}

function waitForPort(port: number, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    (function attempt() {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.end(); resolve(); });
      socket.once('error', () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error('proxy never bound port'));
        else setTimeout(attempt, 100);
      });
    })();
  });
}

function requestThroughProxy(targetUrl: string, proxyPort: number, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const target = new URL(targetUrl);
    let settled = false;
    const finish = (fn: any, val?: any) => { if (!settled) { settled = true; fn(val); } };

    const connectReq = http.request({ host: '127.0.0.1', port: proxyPort, method: 'CONNECT', path: `${target.hostname}:443` });
    const timer = setTimeout(() => { connectReq.destroy(); finish(reject, new Error('timeout')); }, timeoutMs);

    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) { clearTimeout(timer); socket.destroy(); return finish(reject, new Error(`CONNECT ${res.statusCode}`)); }
      const tlsSocket = tls.connect({ socket, servername: target.hostname, rejectUnauthorized: false }, () => {
        const req = https.request({ createConnection: () => tlsSocket, hostname: target.hostname, path: target.pathname || '/', method: 'GET' }, (r) => {
          r.on('data', () => {});
          r.on('end', () => { clearTimeout(timer); finish(resolve); });
        });
        req.on('error', (e) => { clearTimeout(timer); finish(reject, e); });
        req.end();
      });
      tlsSocket.on('error', (e) => { clearTimeout(timer); finish(reject, e); });
    });
    connectReq.on('error', (e) => { clearTimeout(timer); finish(reject, e); });
    connectReq.end();
  });
}

export async function testNode(node: VPNNode): Promise<VPNNode> {
  const timeoutMs = Number(process.env.NODE_TEST_TIMEOUT || 3500);
  const testPort = 20000 + Math.floor(Math.random() * 20000);
  const testUrl = process.env.NODE_TEST_URL || 'https://www.gstatic.com/generate_204';
  const cfgPath = path.join('/tmp', `xray-test-${testPort}.json`);
  let proc: ReturnType<typeof spawn> | null = null;

  try {
    if (!fs.existsSync(XRAY_PATH)) {
      return { ...node, status: 'offline', latency: null, failReason: `xray binary missing at ${XRAY_PATH}`, lastChecked: new Date().toISOString() };
    }
    fs.writeFileSync(cfgPath, JSON.stringify(buildXrayConfig(node.raw, testPort), null, 2));
    proc = spawn(XRAY_PATH, ['run', '-c', cfgPath]);

    await waitForPort(testPort, 1500);
    const start = Date.now();
    await requestThroughProxy(testUrl, testPort, timeoutMs);
    const latency = Date.now() - start;

    return { ...node, status: 'online', latency, speedMbps: null, failReason: null, lastChecked: new Date().toISOString() };
  } catch (err: any) {
    return { ...node, status: 'offline', latency: null, failReason: err.message, lastChecked: new Date().toISOString() };
  } finally {
    if (proc) try { proc.kill(); } catch {}
    try { fs.unlinkSync(cfgPath); } catch {}
  }
}
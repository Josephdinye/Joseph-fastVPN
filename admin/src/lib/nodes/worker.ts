// admin/src/lib/nodes/worker.ts
import { downloadNodeFeed } from './feed';
import { parseVlessNodes } from './parser';
import { validateNode } from './validator';
import { inspectNode } from './security';
import { testNode } from './tester';
import { rankNodes } from './ranker';
import { recordTestResult } from './reputation';
import type { VPNNode } from './cache';
import {
  setNodeCache,
  setNodeTesting,
  setNodeError,
  applyBlocks,
} from './cache';

let running = false;
let intervalStarted = false;

/** One entry per fingerprint/id — prefer online + lower latency */
function dedupeById(nodes: VPNNode[]): VPNNode[] {
  const map = new Map<string, VPNNode>();

  for (const n of nodes) {
    const prev = map.get(n.id);
    if (!prev) {
      map.set(n.id, n);
      continue;
    }

    if (n.status === 'online' && prev.status !== 'online') {
      map.set(n.id, n);
      continue;
    }

    if (n.status === prev.status) {
      const nLat = n.latency ?? 99999;
      const pLat = prev.latency ?? 99999;
      if (nLat < pLat) {
        map.set(n.id, n);
        continue;
      }
      if (nLat === pLat && (n.score ?? 0) > (prev.score ?? 0)) {
        map.set(n.id, n);
      }
    }
  }

  return Array.from(map.values());
}

function publishCache(nodes: VPNNode[]) {
  const ranked = applyBlocks(rankNodes(dedupeById(nodes)));
  setNodeCache(ranked);
  return ranked;
}

export async function refreshNodes() {
  if (running) {
    console.log('[Nodes] Previous cycle still running');
    return;
  }

  running = true;
  setNodeTesting(true);

  try {
    console.log('[Nodes] Starting health cycle');

    const feed = await downloadNodeFeed();
    const parsed = parseVlessNodes(feed);
    console.log(`[Nodes] Parsed ${parsed.length} links`);

    const validated = parsed.filter((n) => validateNode(n).valid);
    console.log(`[Nodes] Valid: ${validated.length}`);

    const inspected = validated.map((node) => {
      const security = inspectNode(node);
      return {
        ...node,
        securityStatus: security.status,
        securityScore: security.score,
        securityReasons: security.reasons,
      };
    });

    // Dedupe before testing so we don't probe the same id twice
    const uniqueInspected = dedupeById(inspected);
    console.log(`[Nodes] Unique after fingerprint: ${uniqueInspected.length}`);

    const testable = uniqueInspected.filter((n) => n.securityStatus === 'approved');
    console.log(`[Nodes] Approved for test: ${testable.length}`);

    for (let i = testable.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [testable[i], testable[j]] = [testable[j], testable[i]];
    }

    const concurrency = Number(process.env.NODE_TEST_CONCURRENCY || 80);
    const results: VPNNode[] = [];
    const rejected = uniqueInspected.filter((n) => n.securityStatus !== 'approved');

    for (let i = 0; i < testable.length; i += concurrency) {
      const batch = testable.slice(i, i + concurrency);
      const batchResults = await Promise.all(batch.map(testNode));

      for (const r of batchResults) {
        recordTestResult(r.id, r.status === 'online');
      }

      results.push(...batchResults);
      publishCache([...results, ...rejected]);

      console.log(
        `[Nodes] Tested ${Math.min(i + concurrency, testable.length)}/${testable.length}`
      );
    }

    const ranked = publishCache([...results, ...rejected]);
    const online = ranked.filter((n) => n.status === 'online').length;
    console.log(`[Nodes] Cycle complete: ${online} online / ${ranked.length} total`);
  } catch (error: any) {
    console.error('[Nodes] Cycle failed:', error);
    setNodeError(error?.message || String(error));
  } finally {
    setNodeTesting(false);
    running = false;
  }
}

export function startNodeWorker() {
  if (intervalStarted) return;
  intervalStarted = true;

  const interval = Number(process.env.NODE_TEST_INTERVAL || 300000);
  void refreshNodes();
  setInterval(() => {
    void refreshNodes();
  }, interval);
  console.log(`[Nodes] Worker scheduled every ${interval / 1000}s`);
}
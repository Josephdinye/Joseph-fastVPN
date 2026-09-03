interface NodeReputation {
  successfulTests: number;
  failedTests: number;
  consecutiveFailures: number;
  lastSuccess: string | null;
  lastFailure: string | null;
  suspiciousEvents: number;
}

const globalRep = globalThis as unknown as {
  vpnNodeReputation?: Map<string, NodeReputation>;
};

if (!globalRep.vpnNodeReputation) {
  globalRep.vpnNodeReputation = new Map();
}

function empty(): NodeReputation {
  return {
    successfulTests: 0,
    failedTests: 0,
    consecutiveFailures: 0,
    lastSuccess: null,
    lastFailure: null,
    suspiciousEvents: 0,
  };
}

export function recordTestResult(id: string, ok: boolean) {
  const map = globalRep.vpnNodeReputation!;
  const r = map.get(id) || empty();
  const now = new Date().toISOString();
  if (ok) {
    r.successfulTests += 1;
    r.consecutiveFailures = 0;
    r.lastSuccess = now;
  } else {
    r.failedTests += 1;
    r.consecutiveFailures += 1;
    r.lastFailure = now;
    if (r.consecutiveFailures >= 5) r.suspiciousEvents += 1;
  }
  map.set(id, r);
}

export function reliabilityScore(id: string): number {
  const r = globalRep.vpnNodeReputation!.get(id) || empty();
  const total = r.successfulTests + r.failedTests;
  if (total === 0) return 50;
  let score = Math.round((r.successfulTests / total) * 100);
  if (r.consecutiveFailures >= 5) score = Math.min(score, 30);
  if (r.suspiciousEvents >= 3) score = Math.min(score, 20);
  return score;
}
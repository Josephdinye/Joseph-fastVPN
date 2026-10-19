// admin/src/lib/nodes/types.ts
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

  /** Parsed security params */
  transportSecurity: 'reality' | 'tls' | 'none' | 'unknown';
  transport: string;
  flow: string | null;
  sni: string | null;
  hasRealityKey: boolean;
  allowInsecure: boolean;

  status: NodeStatus; // for dashboard speed test only
  latency: number | null; // for dashboard only
  speedMbps: number | null; // for dashboard only
  score: number; // for dashboard sort only
  enabled: boolean; // THE ONLY FIELD THAT AFFECTS APP - true = send to app, false = blocked
  failReason: string | null;
  lastChecked: string | null;

  securityStatus: NodeSecurityStatus; // dashboard badge only
  securityScore: number; // dashboard badge only
  securityReasons: string[]; // dashboard badge only
}

export interface SecurityResult {
  status: NodeSecurityStatus;
  score: number;
  reasons: string[];
}

export interface ValidateResult {
  valid: boolean;
  reasons: string[];
}
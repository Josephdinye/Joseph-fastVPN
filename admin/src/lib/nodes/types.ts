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

export interface SecurityResult {
  status: NodeSecurityStatus;
  score: number;
  reasons: string[];
}

export interface ValidateResult {
  valid: boolean;
  reasons: string[];
}
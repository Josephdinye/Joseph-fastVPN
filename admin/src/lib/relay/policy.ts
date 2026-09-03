export const RELAY_POLICY = {
  /** Only these node ids may be used as upstream (from approved RAM set) */
  maxSessionsPerUser: 2,
  maxConcurrentGlobal: 500,
  sessionTtlSec: 3600,
  rateLimitPerMinute: 60,
  /** Destinations relay must never open */
  blockCidrs: [
    '127.0.0.0/8',
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '169.254.0.0/16',
    '0.0.0.0/8',
    '::1/128',
  ],
};
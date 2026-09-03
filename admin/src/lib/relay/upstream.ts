import { getNodeCache } from '../nodes/cache';
import { isNodeAllowed } from '../nodes/firewall';

/** Server-side only — never accept raw VLESS from the client */
export function resolveApprovedUpstream(nodeId: string) {
  const node = getNodeCache().nodes.find((n) => n.id === nodeId);
  if (!node || !isNodeAllowed(node)) return null;
  return {
    nodeId: node.id,
    address: node.address,
    port: node.port,
    raw: node.raw, // only inside relay process
  };
}
import type { IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

/**
 * Constant-time shared-secret check. The ops-agent is never exposed on a
 * public port (see docker-compose.yml — only reachable from `backend` over
 * the internal Compose network), but it still authenticates every request:
 * a compromised or misconfigured neighbour container on the same network
 * must not be able to call it for free.
 */
export function isAuthorized(req: IncomingMessage, sharedSecret: string): boolean {
  const header = req.headers['x-ops-agent-secret'];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!provided) return false;

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(sharedSecret);
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}

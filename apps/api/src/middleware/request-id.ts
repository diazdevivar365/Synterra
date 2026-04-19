/**
 * Synterra API — request ID middleware.
 *
 * Honors an inbound `x-request-id` header when present (allowing upstream
 * proxies / gateways to correlate IDs across service hops); otherwise
 * mints a fresh UUID v4 via `crypto.randomUUID()`. The resolved ID is
 * placed on the Hono context as `requestId` and echoed back in the
 * response header so clients can stitch logs together.
 */
import type { MiddlewareHandler } from 'hono';

export interface RequestIdVariables {
  requestId: string;
}

const HEADER_NAME = 'x-request-id';

function isValidHeaderValue(value: string): boolean {
  // Accept any reasonable opaque token: 1..128 printable non-whitespace chars.
  return value.length > 0 && value.length <= 128 && /^[\x21-\x7e]+$/.test(value);
}

export const requestIdMiddleware: MiddlewareHandler<{ Variables: RequestIdVariables }> = async (
  c,
  next,
) => {
  const incoming = c.req.header(HEADER_NAME);
  const id = incoming && isValidHeaderValue(incoming) ? incoming : crypto.randomUUID();

  c.set('requestId', id);
  c.header(HEADER_NAME, id);

  await next();
};

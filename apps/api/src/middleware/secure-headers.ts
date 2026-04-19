/**
 * Synterra API — secure HTTP response headers.
 *
 * Thin, opinionated wrapper over Hono's built-in `secureHeaders`. Defaults
 * are chosen to be safe for a JSON API (no inline scripts, no framing,
 * strict referrer, HSTS with preload).
 */
import { secureHeaders } from 'hono/secure-headers';

import type { MiddlewareHandler } from 'hono';

export function secureHeadersMiddleware(): MiddlewareHandler {
  return secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
    strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
    referrerPolicy: 'strict-origin-when-cross-origin',
    xFrameOptions: 'DENY',
    xContentTypeOptions: 'nosniff',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: [],
    },
  });
}

import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

export const ORIGIN_SECRET_HEADER = 'x-origin-secret';

/**
 * CloudFront adds a shared secret header to every origin request (ADR-0016), so a request
 * without it did not come through the distribution. The health check is exempt because the
 * container's own HEALTHCHECK calls it directly.
 */
export function originSecretMiddleware(secret: string): RequestHandler {
  const expected = Buffer.from(secret);
  return (req, res, next) => {
    if (req.path === '/api/health') return next();
    const given = Buffer.from(req.header(ORIGIN_SECRET_HEADER) ?? '');
    if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
    res.status(403).json({ code: 'FORBIDDEN', message: 'Requests must come through the site.' });
  };
}

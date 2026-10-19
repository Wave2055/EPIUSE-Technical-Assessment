import type { Request } from 'express';

/**
 * Added by CloudFront as `ip:port` when the /api/* origin request policy includes CloudFront
 * headers (e.g. the managed AllViewerAndCloudFrontHeaders-2022-06 policy), replacing any
 * value the viewer sent (ADR-0016).
 */
export const VIEWER_ADDRESS_HEADER = 'cloudfront-viewer-address';

/**
 * The address a request is rate-limited by. Behind CloudFront and Caddy, `req.ip` is
 * Caddy's, which every visitor would share, so the viewer address CloudFront adds is used
 * instead. That header is trusted only while the origin secret is enforced: then every
 * request came through CloudFront, which sets it itself. Without the check, any client could
 * send its own and pick a fresh rate-limit bucket each time.
 */
export function clientAddress(req: Request, trustViewerHeader: boolean): string {
  if (trustViewerHeader) {
    const viewer = req.header(VIEWER_ADDRESS_HEADER);
    if (viewer) return stripPort(viewer);
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

/** `203.0.113.7:46532` → `203.0.113.7`; IPv6 is unbracketed, so the port is the last part. */
function stripPort(address: string): string {
  const colon = address.lastIndexOf(':');
  return colon > 0 ? address.slice(0, colon) : address;
}

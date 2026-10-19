import type { Request } from 'express';
import { clientAddress } from './client-address.js';

function request(ip: string, headers: Record<string, string> = {}): Request {
  return {
    ip,
    socket: { remoteAddress: ip },
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
}

describe('clientAddress', () => {
  it('uses the CloudFront viewer address when the origin secret is enforced', () => {
    const req = request('172.18.0.3', { 'cloudfront-viewer-address': '203.0.113.7:46532' });
    expect(clientAddress(req, true)).toBe('203.0.113.7');
  });

  it('strips the port from an IPv6 viewer address', () => {
    const req = request('172.18.0.3', { 'cloudfront-viewer-address': '2001:db8::7:443' });
    expect(clientAddress(req, true)).toBe('2001:db8::7');
  });

  it('ignores the header when the origin secret is off, so it cannot be spoofed', () => {
    const req = request('198.51.100.9', { 'cloudfront-viewer-address': '203.0.113.7:46532' });
    expect(clientAddress(req, false)).toBe('198.51.100.9');
  });

  it('falls back to the socket address when the header is missing', () => {
    expect(clientAddress(request('198.51.100.9'), true)).toBe('198.51.100.9');
  });
});

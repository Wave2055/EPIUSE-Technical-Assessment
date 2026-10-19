import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  apiFetch,
  onSessionExpired,
  refreshSession,
  setAccessToken,
} from './api-client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const session = (token: string) => ({
  accessToken: token,
  expiresIn: 900,
  user: { id: crypto.randomUUID(), email: 'a@example.com', role: 'ADMIN', employeeId: null },
});

const fetchMock = vi.fn<typeof fetch>();
const authHeader = (call: number) =>
  new Headers(fetchMock.mock.calls[call]![1]!.headers).get('Authorization');

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  setAccessToken(null);
  onSessionExpired(null);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('apiFetch', () => {
  it('sends the access token and returns the parsed body', async () => {
    setAccessToken('t1');
    fetchMock.mockResolvedValueOnce(json(200, { ok: true }));

    await expect(apiFetch('/employees')).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/employees');
    expect(authHeader(0)).toBe('Bearer t1');
  });

  it('turns an error body into an ApiRequestError', async () => {
    fetchMock.mockResolvedValueOnce(json(409, { code: 'CONFLICT', message: 'Taken.' }));

    const error = await apiFetch('/employees').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Taken.' });
  });

  it('renews an expired access token once and retries the request', async () => {
    setAccessToken('expired');
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED', message: 'Expired.' }))
      .mockResolvedValueOnce(json(200, session('fresh')))
      .mockResolvedValueOnce(json(200, { items: [] }));

    await expect(apiFetch('/employees')).resolves.toEqual({ items: [] });
    expect(fetchMock.mock.calls[1]![0]).toBe('/api/auth/refresh');
    expect(authHeader(2)).toBe('Bearer fresh');
  });

  it('reports an expired session when the refresh fails', async () => {
    const expired = vi.fn();
    onSessionExpired(expired);
    fetchMock
      .mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED', message: 'Expired.' }))
      .mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED', message: 'No session.' }));

    await expect(apiFetch('/employees')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
  });

  it('does not try to refresh after a failed login', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED', message: 'Wrong.' }));

    await expect(apiFetch('/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({
      message: 'Wrong.',
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe('refreshSession', () => {
  it('shares one request between concurrent callers, so the rotating cookie is used once', async () => {
    fetchMock.mockResolvedValueOnce(json(200, session('fresh')));

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(a).toBe(b);
    expect(a?.accessToken).toBe('fresh');
  });

  it('resolves null when there is no session', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { code: 'UNAUTHENTICATED', message: 'No.' }));
    await expect(refreshSession()).resolves.toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from '@/lib/api-client';
import { AvatarUploadError, avatarFileProblem, uploadAvatar } from './api';

const ID = '00000000-0000-4000-8000-000000000001';
const S3 = 'https://epiuse-avatars.s3.eu-west-1.amazonaws.com/';
const KEY = `avatars/${ID}/new.png`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const png = (bytes = 10) => new File([new Uint8Array(bytes)], 'me.png', { type: 'image/png' });

function stubFetch(s3Status = 204) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url.endsWith('/avatar/upload-url')) {
      return json({ url: S3, fields: { key: KEY, Policy: 'p' }, key: KEY, maxBytes: 2097152 });
    }
    if (url === S3) return new Response(null, { status: s3Status });
    if (url.endsWith('/avatar')) return json({ id: ID, hasUploadedAvatar: true });
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('avatarFileProblem', () => {
  it('accepts a small PNG, JPEG or WebP', () => {
    expect(avatarFileProblem(png())).toBeNull();
    expect(avatarFileProblem(new File(['x'], 'a.webp', { type: 'image/webp' }))).toBeNull();
  });

  it('refuses other types and anything over the limit', () => {
    expect(avatarFileProblem(new File(['x'], 'a.gif', { type: 'image/gif' }))).toMatch(/PNG/);
    expect(avatarFileProblem(png(2 * 1024 * 1024 + 1))).toMatch(/under 2 MB/);
  });
});

describe('uploadAvatar', () => {
  it('signs, sends the file to S3 with the policy fields first, then confirms the key', async () => {
    const fetchMock = stubFetch();
    const file = png();

    await expect(uploadAvatar(ID, file)).resolves.toMatchObject({ hasUploadedAvatar: true });

    const [sign, send, confirm] = fetchMock.mock.calls;
    expect(sign![0]).toBe(`/api/employees/${ID}/avatar/upload-url`);
    expect(JSON.parse(sign![1]!.body as string)).toEqual({ contentType: 'image/png' });

    expect(send![0]).toBe(S3);
    const form = send![1]!.body as FormData;
    expect([...form.keys()]).toEqual(['key', 'Policy', 'file']);
    expect(form.get('file')).toBeInstanceOf(File);

    expect(confirm![0]).toBe(`/api/employees/${ID}/avatar`);
    expect(confirm![1]!.method).toBe('PATCH');
    expect(JSON.parse(confirm![1]!.body as string)).toEqual({ key: KEY });
  });

  it('sends nothing for a file it can already tell is wrong', async () => {
    const fetchMock = stubFetch();
    await expect(uploadAvatar(ID, new File(['x'], 'a.gif', { type: 'image/gif' }))).rejects.toThrow(
      AvatarUploadError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not confirm when S3 refuses the file', async () => {
    const fetchMock = stubFetch(400);
    await expect(uploadAvatar(ID, png())).rejects.toThrow(/could not be uploaded/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("passes on the API's reason when uploads are switched off", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({ code: 'AVATAR_UPLOADS_DISABLED', message: 'Picture uploads are not set up.' }, 503),
      ),
    );
    await expect(uploadAvatar(ID, png())).rejects.toBeInstanceOf(ApiRequestError);
  });
});

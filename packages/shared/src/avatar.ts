import { z } from 'zod';

export const AVATAR_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AvatarUploadRequestSchema = z.object({
  contentType: z.enum(AVATAR_CONTENT_TYPES, 'Upload a PNG, JPEG or WebP image.'),
});
export type AvatarUploadRequest = z.infer<typeof AvatarUploadRequestSchema>;

/**
 * A presigned S3 POST (ADR-0013). The browser sends the file as multipart form data to
 * `url` with `fields` first; S3 enforces the type and size limits, not the client.
 */
export const AvatarUploadResponseSchema = z.object({
  url: z.url(),
  fields: z.record(z.string(), z.string()),
  key: z.string(),
  maxBytes: z.number().int(),
});
export type AvatarUploadResponse = z.infer<typeof AvatarUploadResponseSchema>;

export const ConfirmAvatarSchema = z.object({ key: z.string().min(1) });
export type ConfirmAvatarInput = z.infer<typeof ConfirmAvatarSchema>;

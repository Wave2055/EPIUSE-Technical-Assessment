import { randomUUID } from 'node:crypto';
import { DeleteObjectCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { Injectable, Logger } from '@nestjs/common';
import {
  AVATAR_MAX_BYTES,
  type AvatarUploadRequest,
  type AvatarUploadResponse,
} from '@epiuse/shared';
import { ApiError } from '../common/errors/api-error.js';
import { AppConfig } from '../config/app-config.js';
import { gravatarUrl } from './gravatar.js';

const EXTENSIONS: Record<AvatarUploadRequest['contentType'], string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

/**
 * The avatar Chain of Responsibility (ADR-0013): uploaded image → Gravatar → `null`, which
 * the client renders as initials. Uploads go browser → S3 directly via a presigned POST;
 * the API only signs and later confirms them.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);
  private readonly s3: S3Client | null;

  constructor(private readonly config: AppConfig) {
    this.s3 = config.env.AVATAR_BUCKET ? new S3Client({ region: config.env.AWS_REGION }) : null;
  }

  resolveUrl(employee: { avatarKey: string | null; email: string }): string {
    if (employee.avatarKey) return `${this.config.env.ASSET_BASE_URL}/${employee.avatarKey}`;
    return gravatarUrl(employee.email);
  }

  async createUpload(
    employeeId: string,
    { contentType }: AvatarUploadRequest,
  ): Promise<AvatarUploadResponse> {
    const { s3, bucket } = this.requireS3();
    // A random component per upload, so a CDN never serves a stale replaced image.
    const key = `${keyPrefix(employeeId)}${randomUUID()}.${EXTENSIONS[contentType]}`;
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, AVATAR_MAX_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: 300,
    });
    return { url, fields, key, maxBytes: AVATAR_MAX_BYTES };
  }

  /** Checks the key belongs to this employee and the object really landed in S3. */
  async assertUploaded(employeeId: string, key: string): Promise<void> {
    const { s3, bucket } = this.requireS3();
    if (!key.startsWith(keyPrefix(employeeId))) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'That upload does not belong to this employee.');
    }
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    } catch {
      throw new ApiError(400, 'VALIDATION_FAILED', 'The image has not finished uploading.');
    }
  }

  /** Best effort: a leftover object costs cents, a failed request after the DB write is worse. */
  async deleteObject(key: string): Promise<void> {
    if (!this.s3 || !this.config.env.AVATAR_BUCKET) return;
    try {
      await this.s3.send(
        new DeleteObjectCommand({ Bucket: this.config.env.AVATAR_BUCKET, Key: key }),
      );
    } catch (error) {
      this.logger.warn(`Could not delete avatar object ${key}: ${String(error)}`);
    }
  }

  private requireS3() {
    if (!this.s3 || !this.config.env.AVATAR_BUCKET) {
      throw new ApiError(
        503,
        'AVATAR_UPLOADS_DISABLED',
        'Picture uploads are not set up on this server. Gravatar pictures still work.',
      );
    }
    return { s3: this.s3, bucket: this.config.env.AVATAR_BUCKET };
  }
}

const keyPrefix = (employeeId: string) => `avatars/${employeeId}/`;

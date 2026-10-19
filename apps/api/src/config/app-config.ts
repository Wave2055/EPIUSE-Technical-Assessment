import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
    /** HS256 signing key for access tokens (ADR-0014). */
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters.'),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
    /** Defaults to true in production; local HTTP development needs it off. */
    COOKIE_SECURE: z.stringbool().optional(),
    /** Shared header CloudFront adds to origin requests (ADR-0016). Required in production. */
    ORIGIN_SECRET: z.string().min(16).optional(),
    AWS_REGION: z.string().default('af-south-1'),
    /** Bucket for uploaded avatars. Unset disables uploads; Gravatar still works. */
    AVATAR_BUCKET: z.string().optional(),
    /** Prefix for uploaded avatar URLs. Empty means same origin, served by CloudFront. */
    ASSET_BASE_URL: z.string().default(''),
  })
  .superRefine((env, ctx) => {
    // Without the secret the origin check is skipped, leaving the EC2 origin open to anyone
    // who finds its address. In production that must fail at boot, not degrade silently.
    if (env.NODE_ENV === 'production' && !env.ORIGIN_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['ORIGIN_SECRET'],
        message: 'ORIGIN_SECRET is required in production (ADR-0016).',
      });
    }
  });

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validated configuration, injected by class. Startup fails fast with every invalid
 * variable listed, rather than at the first request that needs one.
 */
export class AppConfig {
  private constructor(readonly env: Env) {}

  static fromEnv(raw: NodeJS.ProcessEnv): AppConfig {
    const result = EnvSchema.safeParse(raw);
    if (!result.success) {
      const problems = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
      throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
    }
    return new AppConfig(result.data);
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get cookieSecure(): boolean {
    return this.env.COOKIE_SECURE ?? this.isProduction;
  }
}

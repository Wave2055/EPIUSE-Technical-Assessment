import { AppConfig } from './app-config.js';

const base = {
  DATABASE_URL: 'postgresql://localhost/epiuse',
  JWT_ACCESS_SECRET: 'a-signing-key-that-is-at-least-32-characters',
};

describe('AppConfig', () => {
  it('allows the origin check to be off outside production', () => {
    expect(AppConfig.fromEnv({ ...base, NODE_ENV: 'development' }).env.ORIGIN_SECRET).toBe(
      undefined,
    );
  });

  it('refuses to start in production without ORIGIN_SECRET', () => {
    expect(() => AppConfig.fromEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /ORIGIN_SECRET: ORIGIN_SECRET is required in production/,
    );
  });

  it('starts in production with ORIGIN_SECRET and secure cookies by default', () => {
    const config = AppConfig.fromEnv({
      ...base,
      NODE_ENV: 'production',
      ORIGIN_SECRET: 'a-long-enough-origin-secret',
    });
    expect(config.cookieSecure).toBe(true);
  });

  it('serves the API docs outside production, and only on request in production', () => {
    const production = {
      ...base,
      NODE_ENV: 'production',
      ORIGIN_SECRET: 'a-long-enough-origin-secret',
    };
    expect(AppConfig.fromEnv({ ...base, NODE_ENV: 'development' }).apiDocsEnabled).toBe(true);
    expect(AppConfig.fromEnv(production).apiDocsEnabled).toBe(false);
    expect(AppConfig.fromEnv({ ...production, API_DOCS: 'true' }).apiDocsEnabled).toBe(true);
  });
});

import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { originSecretMiddleware } from './common/guards/origin-secret.middleware.js';
import { AppConfig } from './config/app-config.js';

/**
 * Everything applied to the app outside the module graph. Shared by `main.ts` and the
 * integration tests, so tests exercise the same HTTP surface as production.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfig);

  // In production the SPA and API share one CloudFront origin under /api (ADR-0016).
  app.setGlobalPrefix('api');
  if (config.env.ORIGIN_SECRET) app.use(originSecretMiddleware(config.env.ORIGIN_SECRET));
  // JSON-only API: the page-level CSP belongs to the SPA, and would break the docs UI here.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Employee Hierarchy API')
      .setDescription(
        'Every error body is { code, message, details? }. Sign in with POST /api/auth/login and send the access token as a Bearer header.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document);
}

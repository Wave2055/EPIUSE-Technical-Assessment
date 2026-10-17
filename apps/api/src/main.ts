import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/app-config.js';
import { loadSecretsIntoEnv } from './config/load-secrets.js';
import { configureApp } from './configure-app.js';

try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: the environment (or Secrets Manager) provides configuration.
}
await loadSecretsIntoEnv();

const app = await NestFactory.create(AppModule);
configureApp(app);
app.enableShutdownHooks();
await app.listen(app.get(AppConfig).env.PORT);

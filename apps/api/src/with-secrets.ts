import { spawn } from 'node:child_process';
import { loadSecretsIntoEnv } from './config/load-secrets.js';

/**
 * Runs a command with the Secrets Manager values in its environment, the way `main.ts`
 * sees them. Prisma's CLI reads DATABASE_URL from the environment only, so migrations and
 * the seed need this in AWS (ADR-0018):
 *
 *   node dist/with-secrets.js prisma migrate deploy
 */
const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('Usage: node dist/with-secrets.js <command> [args...]');
  process.exit(64);
}

await loadSecretsIntoEnv();

const child = spawn(command, args, { stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  console.error(`Could not run ${command}: ${error.message}`);
  process.exit(127);
});
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));

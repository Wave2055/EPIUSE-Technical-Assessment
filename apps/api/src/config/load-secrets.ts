import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/**
 * In AWS, the database URL and JWT key live in Secrets Manager and are read at boot through
 * the instance role (ADR-0018). Locally `SECRETS_ARN` is unset and `.env` is used instead.
 * Values already present in the environment win, so an operator can override one by hand.
 */
export async function loadSecretsIntoEnv(): Promise<void> {
  const arn = process.env.SECRETS_ARN;
  if (!arn) return;

  const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
  const { SecretString } = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!SecretString) throw new Error(`Secret ${arn} has no string value.`);

  const values = JSON.parse(SecretString) as Record<string, unknown>;
  for (const [key, value] of Object.entries(values)) {
    if (process.env[key] === undefined && typeof value === 'string') process.env[key] = value;
  }
}

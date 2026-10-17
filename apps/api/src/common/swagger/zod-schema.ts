import type { ApiResponseSchemaHost } from '@nestjs/swagger';
import { z } from 'zod';

type SchemaObject = ApiResponseSchemaHost['schema'];

/**
 * OpenAPI schema for Swagger decorators, generated from the shared zod schema so the docs
 * cannot drift from what the pipe actually accepts.
 */
export function openApi(schema: z.ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io, unrepresentable: 'any' });
  return json as SchemaObject;
}

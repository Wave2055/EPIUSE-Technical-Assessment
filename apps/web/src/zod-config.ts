import { z } from 'zod';

/**
 * The site's CSP forbids eval (ADR-0034). Zod otherwise probes for it with `new Function`
 * as each object schema is defined, which the browser blocks and reports as a violation.
 * Imported first in main.tsx, because ES modules run in import order and the shared
 * schemas are defined while App's imports load.
 */
z.config({ jitless: true });

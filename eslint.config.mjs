import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

/**
 * One lint configuration for the whole workspace (ADR-0003). Framework-specific rules are
 * layered on by path rather than split into per-app configs.
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.generated.ts',
      'apps/api/src/generated/**',
      'infra/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always'],
    },
  },

  /* API — Node environment. NestJS needs decorator metadata, so its decorators read as
     unused expressions to the base rules. Telling the parser about decorator metadata stops
     consistent-type-imports from turning injected classes into type-only imports, which
     erases them at runtime and breaks dependency injection. */
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
    },
    rules: {
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  /* Web — browser environment, React rules (ADR-0005). */
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  /* The route manifest exports the router alongside the lazy() component definitions it
     needs. That is inherent to a route table, not a fast-refresh mistake. */
  {
    files: ['apps/web/src/routes/index.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  /* shadcn/ui primitives are vendored as generated, and export their cva variants and form
     hooks next to the components by convention. Kept as-is so the CLI can update them. */
  {
    files: ['apps/web/src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  /* Tests may lean on non-null assertions and loose typing. */
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  prettier,
);

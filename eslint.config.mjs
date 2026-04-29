import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const nodeGlobals = {
  AbortController: 'readonly',
  Buffer: 'readonly',
  TextDecoder: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  process: 'readonly',
  queueMicrotask: 'readonly',
  setImmediate: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
};

const nodeTestGlobals = {
  ...nodeGlobals,
  fetch: 'readonly',
};

export default [
  {
    ignores: ['.worktrees/**', 'worktrees/**', 'apps/web/**', 'node_modules/**', '**/dist/**', 'output/**'],
  },
  js.configs.recommended,
  {
    files: ['*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: ['*.mjs', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: nodeGlobals,
    },
  },
  {
    files: ['scripts/**/*.test.mjs'],
    languageOptions: {
      globals: nodeTestGlobals,
    },
  },
  {
    files: ['apps/server/**/*.ts', 'apps-new/server/**/*.ts', 'packages/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: nodeGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  {
    files: ['apps/server/**/*.test.ts', 'apps-new/server/**/*.test.ts', 'apps/server/test-support/**/*.ts', 'packages/**/*.test.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: nodeTestGlobals,
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
];

import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restrictedNodeGlobals = [
  'process',
  'Buffer',
  '__dirname',
  '__filename',
  'module',
  'require',
  'exports',
  'global',
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.app.json',
        tsconfigRootDir: import.meta.dirname,
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-restricted-globals': ['error', ...restrictedNodeGlobals],
      'no-restricted-properties': [
        'error',
        { object: 'process', property: 'cwd', message: 'Node globals are not allowed in browser source.' },
        { object: 'process', property: 'env', message: 'Use import.meta.env in browser source.' },
      ],
    },
  },
  {
    files: ['vite.config.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        project: './tsconfig.node.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.test.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
);

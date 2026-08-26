import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    // `dist/` is build OUTPUT — a staged copy of the same TypeScript that is
    // already linted where it lives, plus the vendored JavaScript of whatever
    // Composer installed. Linting it reports every file twice and every
    // third-party file once.
    ignores: [
      'node_modules/',
      'vendor/',
      'public/',
      'pro/public/',
      'dist/',
      '*.config.*',
      'vite.loader-config.mjs',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Build tooling: Node, not a browser. It never ships, and it is outside
    // free's tree for the source contract's purposes (ADR 0029).
    files: ['bin/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['resources/**/*.{ts,tsx}', 'pro/resources/**/*.{ts,tsx}', 'tests/js/**/*.{ts,tsx}', 'pro/tests/js/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];

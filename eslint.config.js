import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
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
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /*
       * **Blocking, and that is the decision** (ADR 0038). ADR 0035 gave up
       * what wp-admin was providing for free — focus rings, keyboard
       * behaviour, roles — and WCAG 2.1 AA is the replacement bar. It is held
       * three ways: Radix covers keyboard interaction and ARIA, contrast is
       * measured once at the token, and these rules cover the mechanical
       * failures — an unlabelled control, a bad role, a click handler on a
       * `<div>`. Near-zero cost, and it fires on the pull request rather than
       * in a review, which is the difference between a bar and an intention.
       *
       * `--max-warnings=0` above means a warning here blocks too, so the
       * recommended set arrives at the severity it is written for.
       */
      ...jsxA11y.flatConfigs.recommended.rules,
    },
  },
];

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
      // A design tool's OUTPUT, not its source. Every `out` directory under
      // `tools` is gitignored and holds generated artefacts — among them a
      // browser IIFE of the renderer, which this config would lint as Node and
      // fail on every `document` in. The generators themselves are linted below.
      'tools/*/out/',
      '.superdesign/tmp/',
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
    // The design-system generator, which is Node AND a browser in one file:
    // it runs under Node, and the bodies it hands to `page.evaluate()` are
    // serialised and run inside Chromium. Both global sets are therefore real
    // here, which is not true of anything in `bin/`.
    //
    // Linted rather than ignored because it drives a real WordPress — a typo
    // costs a four-minute boot to discover.
    files: ['tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
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

      /*
       * **The two exceptions, and they are the same exception twice.**
       *
       * ADR 0039 turns a table into a list of row-cards below 640px with CSS
       * alone — `display: block` on the table, the body, the rows and the
       * cells. In a real browser that can take an element's IMPLICIT role with
       * it, so the table quietly leaves the accessibility tree at exactly the
       * width nobody is testing a screen reader against. Writing the roles out
       * is what survives the change; the DOM stays a table, and
       * `lead-log.test.tsx`'s `findByRole('row', …)` stays true at every width.
       *
       * Both rules are right in general and are reasoning from the static
       * markup: `rowgroup` on a `<tbody>` IS redundant until a stylesheet makes
       * it not, and `<td>` is treated as interactive because it also maps to
       * `gridcell`. Narrowed to the exact element/role pairs rather than
       * disabled, so everything else these rules catch still fires.
       */
      'jsx-a11y/no-redundant-roles': ['error', { thead: ['rowgroup'], tbody: ['rowgroup'] }],
      'jsx-a11y/no-interactive-element-to-noninteractive-role': ['error', { td: ['cell'] }],
    },
  },
];

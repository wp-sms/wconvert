# Premium SDK and build split

Type: research
Status: claimed

## Question

How does WSMS structure its free/premium split and licensing, and what of it
should WConvert copy?

Already decided: WConvert reuses `veronalabs/wp-premium-sdk` and mirrors WSMS's
approach so tooling knowledge transfers. This ticket establishes what that
actually entails, so *Free and premium gating architecture* can make design
decisions on facts rather than assumptions.

Investigate in
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`:

- The `premium/` directory: `Bootstrap.php`, `Container/`, `Abstracts/`,
  `modules/`. How does a premium module register itself, and how does free code
  detect and call into premium code without hard-depending on it?
- `composer.json` — the `SCOPER_PROFILE=premium` flow, php-scoper configuration,
  and what lands in `packages/`. Why is scoping needed and what breaks without
  it?
- How the two distributions are actually built and shipped. Is the free plugin a
  subset build, or one codebase with premium files stripped? Check `.distignore`
  and any build scripts under `bin/`.
- `veronalabs/wp-premium-sdk` — what it provides: license activation, update
  delivery, entitlement checks. What is the runtime cost of an entitlement check
  and can it be called on the front-end hot path?
- The React admin: how premium screens are bundled. `CLAUDE.md` flags that
  `build:dashboard` and `build:premium` both write `public/app/main.js` and
  ordering matters — understand that trap before inheriting the pattern.

Report the mechanics, the sharp edges worth avoiding, and what WConvert should
copy versus do differently given it is starting clean.

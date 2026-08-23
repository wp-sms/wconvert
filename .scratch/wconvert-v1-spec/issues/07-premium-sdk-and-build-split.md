# Premium SDK and build split

Type: research
Status: resolved

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

## Answer

**Copy WSMS's distribution boundary almost verbatim; change the gating boundary.**

### Mechanics found

One private monorepo producing 1 free ZIP + 3 per-tier premium ZIPs (`bin/build.sh`,
driven by `tiers.json`). The premium switch is **on-disk presence of
`premium/src/Bootstrap.php`** (`wp-sms.php:36-39`), and the comment says it outright:
*"The per-tier build IS the entitlement gate — there is no runtime license check that
hides modules already on disk."* `@build-strip-free-start/-end` fences are deleted by
`sed` for the free artifact, and a fail-closed 7-check leak guard
(`bin/verify-free-contract.sh`) runs before zipping. Its check 7 — no free React source
may import a `premium/` path — is drift-proof by construction and worth rebuilding on
day one.

Free code detects premium four ways: a `defined('WP_SMS_PREMIUM_LOADED')` probe (only 4
call sites), a REST permission callback that 403s plus a silent field-drop
(`src/Rest/CampaignController.php:56-92`), premium-owned filters free never calls, and —
the real seam — a **core-declared React registry** (`resources/react/src/lib/extensions.ts`)
where core owns `SLOT_OWNER` and premium modules self-register at import time. Its
three-state render (`ready`/`unavailable`/`locked`) is the best single idea in the
codebase: a paying customer never sees an upsell for a feature they already bought.

### Scoping

No `scoper.inc.php` — all config is `extra.wp-scoper` in `composer.json:56-70`, with
`profiles.premium` adding `veronalabs/wp-premium-sdk`. Only vendor deps are scoped
(`WSms\Dependencies`); first-party `WSms\` stays bare. The concrete collision is not
generic: the SDK's own docblock names `wp-statistics-premium` as a sibling consumer, so
two VeronaLabs premium plugins on one site would fight over
`VeronaLabs\WpPremiumSdk\…`, and WSMS already carries a `method_exists` guard for that
skew. Secondary: `firebase/php-jwt` v5→v6 changed `JWT::decode()`'s signature and is
bundled by half of WP. Instructive inverse: Action Scheduler is deliberately *not*
scoped — "shared library, must NOT be prefixed".

### Entitlement cost — safe, but not the question that matters

`isValid()` / `hasFeature()` / `getTier()` are all one `get_option('wsms_premium')`,
memoized in `PremiumStore::$cache`. Zero HTTP, zero transients, no decryption. The row
is written `autoload=false`, so it is at most one extra `SELECT` per request. Network
only from admin AJAX (`manage_options` + nonce), WP's update transient (12h cache), or a
daily Action Scheduler job gated on `days_remaining <= 16` — a healthy license makes
zero background requests. Failures degrade: `refreshStatus()` swallows and keeps the
cache; expiry costs updates, not features.

### The `main.js` trap

`vite.config.js` and `vite.config.premium.mjs` both write `public/app/main.js` with
`emptyOutDir: true` — **last build wins entirely**, and PHP picks the path from a
constant, never from the file. The failure mode is *not* stray upsells: PHP still
injects `modules[…].enabled = true`, nothing is registered, and every slot renders
"couldn't load". Three aggravators: `npm run build` does **not** run `build:premium` at
all (so `CLAUDE.md:15-16` and `AGENTS.md:30` are both wrong as the scripts stand);
`bin/build.sh free` restores composer but not the JS; and there is no `dev:premium`
watcher. **The reference checkout is in the failure state right now** — zero
`wp-sms-premium` occurrences in `public/app/main.js` with `premium/` present. Measured
artifact delta is ~87 KB, not the ~150 KB `CLAUDE.md` claims, so "eyeball the size" is a
weak tell; `grep -c wp-sms-premium public/app/main.js` is the real one. **Do not share
one output path between two Vite configs that both set `emptyOutDir: true`.**

### What does not transfer: premium features that are front-end display rules

This is the part WConvert cannot copy. WSMS's premium is server-and-admin work — its 4
front-end enqueues live inside module `setup()`, so unentitled code never reaches the
browser and there is nothing to bypass. WConvert's exit intent, A/B testing and advanced
targeting are **browser-evaluated on cached pages where PHP never runs**, the loader is
one shared static asset, and anything shipped is editable.

So entitlement must become an **enqueue-time** decision — one option read, baked into
the cached HTML — never a render-time or client-side one. The per-request
`scandir` + `json_decode` module discovery WSMS does on every front-end request should
not be copied.

Three options were laid out (build-time subset / free loader + entitled add-on script
with a `registerTrigger` seam / single flag-gated loader), with the middle one
recommended: enforceable value pushed to REST permission callbacks (A/B assignment,
stats ingest, ESP dispatch), and a copied exit-intent handler treated as accepted
low-severity loss. **Flagged as input to *Free and premium gating architecture* (13),
not a pre-emption of it** — three questions are deliberately left to that ticket.

### Structural note

WSMS ships free and premium as **two mutually exclusive plugins** with different slugs
and install folders, which costs it a whole compatibility shim
(`src/premium-compatibility.php`) and a silent `deactivate_plugins()` in the premium
activation hook (`wp-sms.php:183-190`). WConvert starts clean and should weigh "free
plugin + premium add-on plugin" instead. Note this converges with *wp.org rules for
freemium and remote libraries* (06), which found the directory explicitly recommends
that shape: *"We recommend the use of add-on plugins, hosted outside of WordPress.org,
in order to exclude the premium code."*

Also flagged: the shipped elite ZIP is missing the `tiers.json` its own `TierGate` reads
at runtime — benign only because every lookup fails open.

Full findings, with quoted config and a copy/adapt/avoid table:
[`research/07-premium-sdk-and-build-split.md`](../research/07-premium-sdk-and-build-split.md)
on branch `research/07-premium-sdk-and-build-split`.

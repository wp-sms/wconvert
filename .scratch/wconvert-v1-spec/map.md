# Map: WConvert v1 Spec

Label: `wayfinder:map`

## Destination

A written product + architecture spec for **WConvert v1** — sharp enough that a
build session can start from it without re-litigating scope. It names what
WConvert is, what it deliberately is not, how it stores and moves data, how it
reaches the front end, and where the WSMS and premium seams sit.

Reaching the destination means: nothing left to *decide* before someone builds.
No code is written on this map except throwaway prototypes.

## Notes

**Domain.** WordPress plugin. PHP 8.1+, React admin, Vite. Lead capture and
conversion display — popups, bars, slide-ins, inline forms. Ships free on
wp.org with a premium tier. Runs standalone; integrates with WP SMS (WSMS) when
present.

**Read first, every session.** [`CONTEXT.md`](../../CONTEXT.md) — the glossary
is load-bearing. `Optin`, `Lead`, `Contact`, `Goal`, `Playbook`, `Destination`
and `Standalone` all have precise meanings, and several exist specifically to
avoid collisions with WSMS's vocabulary. Use them exactly.

**Reference codebase.** WSMS 8 lives at
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`.
It is the convention source (DI container, service providers, Vite + React
admin, PHPStan, PHPUnit, Playwright, premium build split) and the integration
target — but **no code is shared**. Read its `AGENTS.md` and `.claude/rules/`
before proposing anything structural.

**Skills.** `/grilling` + `/domain-modeling` on every grilling ticket.
`/research` for research tickets. `/prototype` for prototype tickets.

**Standing preferences.**
- Planning only. Produce decisions, not deliverables — prototypes excepted, and
  those are throwaway.
- Adopt WSMS's rule: **a new database table or column needs explicit sign-off.**
  Say why storage is needed and which table-free alternatives were rejected.
- Active development. No back-compat, deprecation shims, or migration paths.
- Update `CONTEXT.md` inline the moment a term is settled — do not batch.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

_Charting session — decisions below came from the grilling that produced this
map, not from tickets. Ticket resolutions append here._

- **Destination of the effort** — a written product + architecture spec for v1, not
  a locked decision set and not a running skeleton.
- **Boundary with WSMS** — WConvert owns the display layer (what shows, to whom,
  when, where) plus conversion analytics. It owns no Contacts, lists, tags, or
  segments. WSMS keeps those.
- **Standalone behaviour** — a local Lead log (submission events + CSV export), not
  a contact system. A Lead is an event; a Contact is an entity.
- **WSMS integration direction** — registers into WSMS's `ExtensionRegistry` for
  discovery and admin presence; data flows one-way WConvert → WSMS. WSMS is
  never a runtime requirement of the capture path.
- **Display types in v1** — popup, floating bar, slide-in, inline/embed. One
  rendering primitive covers all four.
- **Front-end delivery** — small deferred loader + per-URL campaign JSON in the
  page; all rule evaluation client-side; per-visitor state in cookies and
  localStorage. Chosen because full-page caching is non-negotiable. Hard budget:
  **<15KB gzipped**. *Constrained by [wp.org rules for freemium and remote
  libraries](issues/06-wporg-rules-for-freemium-and-remote-libraries.md): the
  directory is silent on cookies — the constraint is ePrivacy, not policy — but
  the readme must never claim GDPR compliance, and the stored value stays
  non-identifying with a site-owner switch to defer it.*
- **Builder** — curated template gallery + constrained settings panel. No canvas
  in v1; the data model must let one land later without a migration.
- **Free / premium** — free: popup + inline, page targeting, time delay, scroll
  depth, local lead log, CSV export, WSMS integration. Premium: exit intent, A/B
  testing, advanced targeting, floating bar + slide-in, third-party ESPs.
  *Constrained by [wp.org rules for freemium and remote libraries](issues/06-wporg-rules-for-freemium-and-remote-libraries.md):
  the split must stay a **feature** split, never a usage cap — no "up to N
  leads/month", which would make it trialware. Premium code must be **absent**
  from the free ZIP, not present-and-disabled, and the premium SDK, licence
  field and update-checker ship **only** in the premium plugin.*
- **Codebase relationship** — fresh repo, WSMS conventions copied, no shared code
  and no shared release cycle.
- **Naming** — the unit of work is an `Optin`, not a `Campaign`. WSMS's `Campaign`
  already means a throttled batch send.
- **Goal orientation** — Goal is a first-class persistent field on the Optin and
  replaces Display Type as the primary axis of creation. No activation wizard.
  "Start from scratch" stays one click away.
- **Goal taxonomy (v1)** — Grow my email list · Grow my SMS list · Recover
  abandoned carts · Promote a sale or offer · Deliver a lead magnet. "Announce
  something" and "Reduce bounce" held back.
- **Playbook** — the Goal→Optin bundle is a `Playbook`, shipped as a local
  registry with remote fetch designed in but not built. *Constrained by [wp.org
  rules for freemium and remote libraries](issues/06-wporg-rules-for-freemium-and-remote-libraries.md):
  "data, not code" must be **enforced**, not described — **content, never
  capability**, a closed rule vocabulary with no expression evaluation, `wp_kses`
  with a custom allowlist, and server-side fetch cached locally. The exposure is
  Guideline 3 (distributing behaviour outside the directory) more than
  Guideline 8.*
- **Admin IA** — conventional nav in v1, with a per-goal breakdown on the
  dashboard as the seed for a goal-centric IA later.

- [WSMS integration surface](issues/04-wsms-integration-surface.md) — couple to the
  PHP repository (`contact.repository` → `ContactRepositoryInterface`) behind one
  adapter. REST is an *admin console* API, not an ingestion API: its permission
  callback fails for an anonymous capture even via `rest_do_request()`. WSMS has no
  third-party ingestion surface and disclaims back-compat, so the instability is
  accepted and isolated, not engineered around. Local Lead row first, WSMS push as a
  post-write side effect; default contact status `pending`. Worth asking WSMS for a
  named `wsms_capture_contact()`.
- [ESP landscape for v1](issues/05-esp-landscape-for-v1.md) — v1: Mailchimp,
  MailerLite, Brevo, Kit + a generic Webhook, **no OAuth**. Ranked on WP-specific
  evidence (wp.org installs cross-checked against what Elementor/WPForms/Fluent
  Forms/Popup Maker/Hustle actually ship). Pushes must be **queued**, not
  synchronous. Kit is the booked risk: it disclaims API-key support for public
  integrations.
- [wp.org rules for freemium and remote libraries](issues/06-wporg-rules-for-freemium-and-remote-libraries.md)
  — **nothing on the map is invalidated**; three decisions gained constraints
  (above). Biggest risk is Guideline 3, not 8. Visible degradation and the remote
  library are one design: degradation is what keeps the library on the data side.
- [Premium SDK and build split](issues/07-premium-sdk-and-build-split.md) — copy
  WSMS's distribution boundary (premium overlay dir, `sed` strip fences, fail-closed
  pre-zip leak guard, React slot registry); entitlement is one memoized
  non-autoloaded option read. **Move the gating boundary from module boot to asset
  enqueue** — WConvert's premium features are browser-evaluated on cached pages.
  Never share one output path between two Vite configs that both `emptyOutDir`.

## Not yet specified

<!-- in-scope fog: real, but not yet sharp enough to ticket -->

- **A/B testing's claim on the Optin model.** Premium and post-v1, but variants
  either fit the Optin schema or force a migration. The question only becomes
  askable once *Storage and entity model* lands.
- **RTL and i18n.** VeronaLabs ships to an RTL-first audience and popups are
  position-sensitive in ways admin screens are not. Probably constrains the
  rendering primitive; unclear yet whether it is its own decision or a
  constraint inside *Popup isolation on hostile themes*.
- **Migration in from competitors.** Importing OptinMonster / Thrive Leads /
  OptiMonk campaigns is a real switching aid. Shape depends entirely on the
  Optin schema.
- **WooCommerce coupling depth.** "Recover abandoned carts" is a v1 Goal and
  cart state is a WooCommerce concept. How deep that hook goes — and what the
  Goal degrades to without WooCommerce — sharpens after *Display rule engine*.

## Out of scope

<!-- ruled beyond this destination; never graduates -->

- **Full contact management in WConvert** — own contacts, lists, tags, segments,
  opt-out lifecycle. Rejected: two contact databases means two consent models,
  two GDPR export paths, and support tickets where the plugins disagree about
  who is unsubscribed.
- **A shared core package between WConvert and WSMS** — architecturally cleanest,
  but couples two release cycles before either product has shipped. Revisit as a
  v2 refactor once both are real.
- **Gamified optins (spin wheel) and content lockers** — premium differentiators
  to build once the engine is proven, not v1 table stakes.
- **Drag-and-drop canvas builder** — the largest cost sink in this category and
  the worst place to compete against a decade of OptinMonster polish. v1 uses a
  template gallery; the data model must not preclude a canvas later.
- **Goal-centric admin IA** — optins grouped by goal, performance reported per
  goal, gap prompts. The logical endpoint of first-class Goals and genuinely
  differentiating, but a large design job whose failure mode is the Thrive Leads
  trap: an IA more confusing than a plain list.
- **Activation-time onboarding wizard** — the weakest form of goal orientation.
  Fires once, high skip rate, and the goal screen at creation time does the same
  job better and every time.

# The rule model is three flat, closed axes

An Optin's display rules are split into **Targeting** (server-evaluated at
asset-enqueue time, never sent to the browser), **Triggers** (*when* it fires —
any one), and **Conditions** (*whether* the visitor is eligible — all must hold
at the instant a Trigger fires). Within each axis the rules are a **flat list of
`{type, scalar}` entries with implicit AND** — no groups, no nesting, ever.

Three axes rather than one array because the storage model requires page
targeting to be separately addressable — PHP evaluates it alone and inlines only
the survivors — and structural separation means PHP never reasons about client
rule types, the finished rule is *stripped* from the payload rather than shipped
and re-evaluated, and a later server-evaluable rule cannot be silently missed by
the enqueue filter. Two client axes rather than one because an engine holding
several eligible Optins cannot otherwise distinguish "waiting for its moment"
from "this visitor is not eligible"; a working two-kind model came out of the
loader prototype and is what made the multi-Optin case behave sensibly.

## The nesting ceiling is deliberate and permanent

The original argument against expressiveness was the 15KB budget. That budget is
retired — the prototype measured the *entire* v1 rule vocabulary at 1.3KB
gzipped inside a 3.9KB loader — so the ceiling stands on different ground:

- **Playbooks are remote-supplied data.** A flat list of enum-plus-scalar entries
  is finite and mechanically checkable against the rule manifest. An
  arbitrary-depth boolean tree is a language, and the wp.org research is explicit
  that a remotely-sourced rule set must be **content, never capability**. This is
  the same reasoning that rules out `symfony/expression-language`, which WSMS
  bundles and which is therefore one `composer require` away.
- **"Why didn't my popup show?" is the support ticket in this category.** A flat
  list yields a readable per-rule pass/fail table. A tree yields a stack trace.
- **The real OR cases are one rule with several values** — "mobile or tablet",
  "from Google or Bing" — which set-valued scalars (`{"type":"device","in":[…]}`)
  answer without any boolean structure at all.

Recorded as permanent rather than "not in v1" on purpose: "we'll add OR later" is
the exact path by which the expression language arrives.

## Consequences

- **One JSON manifest is the single source of truth** for every rule type — kind,
  tier, parameter schema, device applicability, UI presets. PHP reads it at
  runtime; the JS build imports it; the evaluator switch is the only hand-written
  duplicate, and a test asserts parity. This makes the vocabulary's closedness
  mechanical rather than a convention.
  *The field list has grown twice since. `CONTEXT.md`'s Storage Consent entry
  adds **`consent_category`** beside `tier` — every Trigger and Condition
  declares the WP Consent API category its storage falls under — and
  [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md) adds
  **`on_absence: drop | suspend`**.
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) asserts that
  every entry carries all four — `tier`, `consent_category`, `on_absence`, kind —
  and resolves to an implementation on the side its `tier` names.*
- **One engine type, many UI presets.** The engine gets the general form
  (`total_pageviews {min, max}`, `query_param {key, value}`); the builder ships
  the legible shortcuts ("returning visitor", the UTM fields). A rich admin over
  a small closed vocabulary depends on this being the standing rule.
- **Rules are partitioned into `triggers` and `conditions` at publish time**, not
  at evaluation time. Kind is a fixed property of the type, so the manifest
  already knows the answer and the client should not re-derive it per page view.
- The premium filter strips unentitled rules at enqueue, so the free loader may
  carry the whole evaluator harmlessly — an unentitled site never receives a rule
  of that type. Hand-injecting one would work; that is the accepted
  low-severity loss the build-split research already booked.
  *Amended by [ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md):
  the free loader does **not** carry the whole evaluator. Premium rule modules
  live under Pro's own module tree and free's source never imports them, so the
  premium branches are absent from free's build rather than dead inside it, and
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) scans free's
  built loader for premium rule identifiers on every pull request. The
  enqueue-time strip is unchanged; the accepted loss is now copying Pro's loader
  onto a free install
  ([ADR 0015](0015-enforcement-is-by-non-registration.md)), not hand-injecting a
  rule into free's.*

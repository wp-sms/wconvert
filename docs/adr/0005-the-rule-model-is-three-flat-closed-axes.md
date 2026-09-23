# The rule model is three flat, closed axes

An Optin's display rules are split into **Targeting** (server-evaluated at
asset-enqueue time, never sent to the browser), **Triggers** (*when* it fires —
any one), and **Conditions** (*whether* the visitor is eligible — all must hold
at the instant a Trigger fires). Within each axis the rules are a **flat list of
`{type, scalar}` entries with implicit AND** — no groups, no nesting, ever.

*Amended by [ADR 0048](0048-the-eligibility-inspector-runs-on-the-real-page.md):
"never sent to the browser" is now **almost** true, and the exception is
deliberate and narrow. The eligibility inspector prints the Targeting axis —
with each rule's pass/fail against this request — into a second JSON tag, on a
request that is admin-gated by `current_user_can()`, parameter-gated by
`?wconvert-inspect=1`, and marked uncacheable. The ORDINARY payload still
carries no Targeting at all: it is stripped in `PublishedOptin::toPayloadEntry()`
and `tests/unit/Optin/PublishedProjectionTest.php` pins the keys that travel.
What this ADR was protecting was the byte budget and the reason for it — nobody
should pay for a rule the server already answered — and a tag nobody but an
administrator can cause to exist pays none of it.*

*The other half of this ADR that went unbuilt for as long: "a flat list yields a
readable per-rule pass/fail table". That table is
`WConvert\Targeting\TargetingExplainer` and the panel that draws it. The
flatness is what made it a table.*

*Extended by [#92](https://github.com/navidkashani/wconvert/issues/92) without
changing shape, and the completion note below predicted it exactly: **`role` is
the SECOND field beside `logged_in`**, not a member of either list.
`RuleManifestParityTest` used to assert the visitor half was exactly
`logged_in`, and its docblock said why — "a second visitor rule would need a
second field, and this is what says so" — so adding role failed it, which is the
mechanism working. It was not widened to "any visitor rule": the test now pins
BOTH names, so a third fails it again, and a second test walks the manifest's
own visitor half and asserts none of them is constructible inside a list at all.
Role is also one predicate over several systems rather than one per system — a
membership or LMS plugin registers a `RoleSource` and adds no rule type — which
is the same "zero new lists" rule the tier split follows.*

*Completed by [#21](https://github.com/navidkashani/wconvert/issues/21) for the
Targeting axis: "implicit AND" is the rule for the two CLIENT axes, and this
originally read as though it were the rule for all three. Targeting is a **page
set**, so its include list ORs — `post:12 AND post:15` is a set that can never
contain a page, which is not what a merchant choosing two pages means. The axis
is therefore an include list unioned, an exclude list unioned, **exclude
winning**, and one visitor predicate `logged_in` held as a FIELD beside them
rather than as a member of either list — dropped into an include list a visitor
rule would WIDEN the Optin to the whole site for anyone matching it, since the
list is a union. Read whole, the axis is `page-set AND logged_in`, which is the
implicit AND this ADR asks for.*

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

> **Amended by [ADR 0104](0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md):** Saved Campaigns now use bounded audience groups (OR between groups, ALL/ANY within) and a separate opening mode. Recursive nesting remains forbidden. Server login/role predicates are leaves inside audience groups; page exclusions remain universal. The flat-axis ceiling and global account predicate below are historical.

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
  *Corrected by [#22](https://github.com/navidkashani/wconvert/issues/22) on two
  words. **"The JS build imports it" cannot stand beside
  [ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md).** A
  whole-manifest import inlines every entry into the bundle that imports it,
  premium ones included — the lookup is dynamic, so nothing tree-shakes — which
  makes free's loader fail the very scan
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) runs over it.
  Free's loader therefore does **not** import the manifest: each loader module
  declares its own `kind` and `consent_category`, and `tests/js/manifest-parity.test.ts`
  plus `pro/tests/js/manifest-parity.test.ts` assert the declaration matches the
  manifest. The manifest's runtime readers are PHP and the tests. And **"the
  evaluator switch" is a module set**, for the same reason 0028 gives: one switch
  would have to name `exit_intent`, and premium code is absent from free's source
  rather than dead inside it. The duplicate is still one duplicate, and a test
  still asserts parity — which is all this consequence was ever asking for.*
  *The field list has grown three times since. `CONTEXT.md`'s Storage Consent
  entry adds **`consent_category`** beside `tier` — every Trigger and Condition
  declares the WP Consent API category its storage falls under —
  [ADR 0027](0027-a-load-bearing-condition-suspends-rather-than-drops.md) adds
  **`on_absence: drop | suspend`**, and
  [#33](https://github.com/navidkashani/wconvert/issues/33) adds
  **`substitute`**: the complete rule that runs in place of a premium one,
  which is [ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md)'s
  table living in the only place that ADR permits a substitution to be
  declared. A COMPLETE rule rather than a type name, because a Trigger with no
  params can never fire; only a Trigger may carry one; and it must name a free
  type of the same kind with every non-`authored` param filled — all asserted
  in `tests/unit/Rules/RuleManifestParityTest.php`, because a substitute that
  could not fire is the silent loss it exists to prevent, one indirection
  further along.*
  *Completed by [#29](https://github.com/navidkashani/wconvert/issues/29), which
  replaced the single `value` word with **`params`** — the KEYS a rule's scalar
  arrives under, the control each takes, and an `authored` flag for the ones a
  [[Playbook]] may not supply — and added **`presets`** under each entry. Until
  then the param key was implicit and known only to the loader module that read
  it, which is how three of the four bundled Playbooks shipped
  `['type' => 'time_on_page', 'value' => 8]` against a module reading
  `rule.seconds`: a Trigger that could never fire, prefilled onto every Optin
  they started, with nothing in any log. `authored` also replaces the `_id`
  suffix heuristic the Playbook registry used, so a post id and
  `click_element`'s CSS selector are refused by one rule rather than by a rule
  and a special case.
  [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) asserts that
  every entry carries all four — `tier`, `consent_category`, `on_absence`, kind —
  and resolves to an implementation on the side its `tier` names.*
  *Five as of [#33](https://github.com/navidkashani/wconvert/issues/33), which
  added `substitute` (above). It also carved out the ONE key beyond a type's
  declared params that survives a save: **`degraded_from`**, the marker
  recording which rule this one was substituted for. It is PROVENANCE rather
  than configuration and is deliberately NOT a param — declared as one it would
  draw a control and invite the merchant to edit the record of a substitution —
  so `normalize()` exempts it by name and `partition()` strips it again, since
  nothing that renders an Optin reads it and the payload is inlined into every
  matching page.*
  ***Six as of [#36](https://github.com/navidkashani/wconvert/issues/36), which
  added `requires`*** *— the [[SiteDependency]] a rule type needs, which is the
  half of [[Availability]] that is not about [[Pro]] and the one thing we cannot
  sell. It is filed the same way `tier` is, beside the member on a registry that
  already enumerates it, so the count of separate lists is still zero
  ([ADR 0015](0015-enforcement-is-by-non-registration.md)).*

  ***This list has grown once per reader and never once ahead of one***, *which
  is what keeps [ADR 0029](0029-the-free-contract-is-proven-at-the-source.md)'s
  "nothing is written before its subject" true of a manifest that is now six
  fields wide rather than a slogan it has outgrown.* `substitute` *waited for
  #33's resolver;* `requires` *arrived with three readers on one pull request —
  the registration gate that stops a rule nothing can answer being registered as
  though it could, the [[Availability]] arithmetic where `unavailable` starts
  beating `locked` for a rule type, and the sentence a merchant reads on the
  Optin list. The pressure is always to add the field first and the reader
  later; the answer each time has been to ship them together.*
- **One engine type, many UI presets.** The engine gets the general form
  (`total_pageviews {min, max}`, `query_param {key, value}`); the builder ships
  the legible shortcuts ("returning visitor", the UTM fields). A rich admin over
  a small closed vocabulary depends on this being the standing rule.
  *Built in [#29](https://github.com/navidkashani/wconvert/issues/29), and the
  standing rule is now structural rather than remembered: **a preset is declared
  INSIDE the entry for the type it fixes params on**, so it has no field to name
  a second type with. `query_param {key, value}` shipped with it, carrying the
  three UTM presets; `total_pageviews` did not, because counting page views
  needs storage on the visitor's device and therefore a consent category and a
  call site that increments on every page view — a design that belongs with the
  Pro rule set rather than with the builder. The translation is asserted in both
  directions over the manifest that ships
  (`tests/js/builder-presets.test.ts`).*
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

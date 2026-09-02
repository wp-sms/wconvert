# A load-bearing condition suspends rather than drops

[ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md) drops a
[[Condition]] the install cannot evaluate, because *"dropping only widens the
audience."* That reasoning has a boundary, and this ADR draws it.

A Condition is **load-bearing** when the [[Optin]]'s copy asserts the fact it
guarantees. Dropping one does not widen an audience — it makes the Optin **say
something false**. Such a Condition carries **`on_absence: suspend`**, and an Optin that
holds one is not shown at all while the Condition is unavailable.

*Widened by [#33](https://github.com/navidkashani/wconvert/issues/33), which
built the mechanism and found a **second** way into it. A premium [[Trigger]]
with no honest substitute — `click_element`, whose selector names something
only one site has — is dropped like any other, and an Optin that loses its LAST
Trigger that way can never fire: the silent, total loss
[ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md) names
as this category's defining support ticket. So suspension is not only what a
`suspend`-marked Condition triggers; it is also what
[`Degradation`](../../src/Rules/Degradation.php) does when degradation would
leave an Optin inert. Same state, same screen, same self-healing, reached from
the Trigger axis. Recorded inline on ADR 0012's first bullet too.*

## The case ADR 0012 did not see

*"You left 3 items in your cart"* is guaranteed by `cart_has_items`. Drop it and the
sentence shows to visitors who have never added anything.

[ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md) closes the *free install*
case by making the Goal `tier: pro`, so the Optin cannot be built without the Condition.
It does not close the **removal** case: a merchant builds the Optin with [[Pro]], then
deactivates Pro. The premium Condition stays in `config`, free's loader does not know
the type, and enqueue-time degradation drops it — the same lying popup, arrived at from
the other side. Deactivating WooCommerce while keeping Pro does the same.

This is a direct consequence of [ADR 0015](0015-enforcement-is-by-non-registration.md):
possession gates features, so a feature can stop being possessed at any moment, and
config outlives the code that reads it.

## Why a manifest field and not a special case

`on_absence: drop | suspend` is a **third property beside `tier` and `consent_category`
on the rule manifest** that both runtimes already read
([ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md)). It defaults to `drop`,
so ADR 0012 remains the rule and this is the marked exception. Both cart Conditions set
`suspend`.

***And `suspend` alone does not close the WooCommerce half.*** *Recorded by
[#36](https://github.com/navidkashani/wconvert/issues/36), which found it live.
The field only fires where the rule type is UNSUPPLIED, and supply is
registration ([ADR 0015](0015-enforcement-is-by-non-registration.md)) — so on a
Pro install with WooCommerce deactivated, a Pro that registered every `tier: pro`
type at boot made `cart_has_items` supplied, not suspended, and shown. The
missing half is a **fourth** property on the same entry, `requires`, naming the
[[SiteDependency]] the rule needs; both service providers ask it at registration,
so a rule the site cannot serve reads as unsupplied and this ADR's whole
mechanism applies unchanged. `Degradation` gained no site branch, and the enqueue
path still asks no tier question of any kind. See
[ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md) for why the CAUSE has
to distinguish the two.*

*Read for the first time by [#33](https://github.com/navidkashani/wconvert/issues/33):
until then `on_absence` was a field nothing consulted. `suspend` is still declared by
NOTHING that ships — the two cart Conditions that set it are
[#36](https://github.com/navidkashani/wconvert/issues/36)'s, and they arrive with the
cookie and the loader modules that read them — so the exception is exercised against a
manifest the test writes, which is also what proves the DEFAULT: the same entry with
the field left out is dropped. That the mechanism precedes its first declaring entry is
deliberate and is the shape #36 is blocked on, not the "field nothing reads" this map
has refused four times: it has a reader, two call sites and a screen.*

***Declared as of [#36](https://github.com/navidkashani/wconvert/issues/36).***
*`cart_has_items` and `cart_value_min` ship with `on_absence: suspend`, and they
are the first entries in the manifest to carry it —
`tests/unit/Rules/RuleManifestParityTest.php` pins both by type rather than
deriving them, because the whole point of `suspend` is that somebody CHOSE it: a
rule that quietly reverted to the `drop` default would ship exactly the lying
popup, and the default is what an entry saying nothing gets.*

*Completed by [#22](https://github.com/navidkashani/wconvert/issues/22), which gives
every client entry a concrete value for the first time. **`drop` on a Trigger does not
mean a Trigger is dropped.** [ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md)
substitutes premium Triggers, and this field is not where that lives — the substitution
is a separate manifest property, applied by the thin resolver 0012 describes at two call
sites. `on_absence` answers only what happens where no substitute is declared, which for
a Trigger is the zero-trigger loss 0012 names and for a Condition is the whole question.
Free's Triggers therefore read `drop` vacuously: free is always installed, so their
absence never arises. The substitution property lands with the resolver in
[#33](https://github.com/navidkashani/wconvert/issues/33), because a field nothing reads
is a fourth hand-maintained list with extra steps.*

The alternatives each put the fact in the wrong place:

- **A Playbook-level flag** — a [[Playbook]] is snapshotted at prefill and then never
  speaks again ([ADR 0013](0013-playbook-copy-carries-no-markup.md)), so it cannot
  govern behaviour years later on an Optin it has no link to.
- **Hard-coding "cart rules are special" in the engine** — the unnamed exception ADR
  0005's closed vocabulary exists to prevent.
- **A separate list of load-bearing rule types** — the fourth hand-maintained list this
  design has now refused four times.

## What a suspended Optin does

**Computed, visible, silent, self-healing.**

- **Computed** — suspension is a pure function of the Optin's `config` plus the live
  registry, evaluated at enqueue and at list time. It is never a stored column, so it
  cannot drift, and it adds **no new storage**.
  *The "live registry" is [`SuppliedRules`](../../src/Rules/SuppliedRules.php) as of
  [#33](https://github.com/navidkashani/wconvert/issues/33) — the rule types that
  actually registered on this request, free's from the manifest's free tier and Pro's
  from its own. At LIST time the question is asked of the **published** set rather than
  of the draft, and for two reasons: suspension is a statement about what the site is
  serving, so a draft is not suspended but unfinished; and the published set is one
  non-autoloaded option, where the summary projection deliberately drags no LONGTEXT
  ([ADR 0001](0001-custom-tables-not-custom-post-types.md)).*
- **Visible** — the Optin list shows the state and its cause: *"Suspended — WooCommerce
  not active"*, *"Suspended — Pro not active"*. This is the screen a merchant actually
  looks at when something stopped working, which is what makes ADR 0026's silent goal
  screen acceptable.
  *Named in full as of [#36](https://github.com/navidkashani/wconvert/issues/36):
  this bullet's own example, "Suspended — WooCommerce not active", was unreachable
  until a rule type declared a dependency, and the branch that would have rendered
  it said only "not available on this site". Both halves now say which thing is
  missing, because a merchant reading a row is a merchant deciding what to go and
  turn back on.*
  *Built as [`Suspension`](../../src/Optin/Suspension.php) in
  [#33](https://github.com/navidkashani/wconvert/issues/33), and the cause is RESOLVED
  rather than asserted: the resolver reports the rule type it could not run — the code
  that did not run cannot say why it did not — and the sentence comes from that type's
  [[Availability]], through the arithmetic
  [`RuleCatalogue`](../../src/Rules/RuleCatalogue.php) already does. That is what keeps
  [ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)'s line intact here:
  `locked` may name Pro and `unavailable` may not, so a screen that collapsed the two
  would offer a merchant a WooCommerce licence we do not have. The row also keeps its
  **Unpublish** control, because the site is holding the Optin back and the merchant
  did not: offering Publish would read as "this never went live".*
- **Silent** — excluded from the published set, so it emits no impressions and no
  conversions. History stays clean and periods stay comparable: a suspended Optin
  contributes nothing rather than contributing zeroes against a live denominator.
  *Precisely: excluded from the PAYLOAD, since the set itself is built at publish time
  and nothing about a suspended Optin is destroyed. Absence from the page is what
  delivers "emits nothing" for a visitor arriving now —
  [#33](https://github.com/navidkashani/wconvert/issues/33) — but it is not the whole
  of it, and that gap is the one this bullet would have shipped with: **a page cached
  BEFORE the dependency went away still carries the entry, and its loader still
  beacons.** So the beacon asks the same question where the count would land
  ([`PublishedOptin::servableIdsIn()`](../../src/Optin/PublishedOptin.php)), and a
  counter that cannot be recomputed afterwards
  ([ADR 0019](0019-analytics-stores-daily-counters-not-events.md)) never receives the
  row. The CAPTURE route deliberately does not ask it: a [[Lead]] somebody actually
  typed is the one genuinely unrecoverable loss available here, and the Lead log is not
  where a [[Conversion]] is counted.*

  *Contrasted by [ADR 0050](0050-a-scheduled-optin-stays-in-the-published-set.md),
  which reaches this bullet's outcome — no rows, never zero-valued ones — for a
  scheduled Optin **without excluding anything and without a second question at
  the beacon**. The difference is what a cached page can hold: suspension is
  computed against a live rule registry, so a stale page cannot answer for
  itself and has to be caught again where the count lands; a schedule is two
  numbers that travel in the payload, so every page holding them answers
  correctly on its own, shows nothing, reports nothing, and no counter ever
  receives a row. The two cases look alike and this is the one thing they
  differ on.*
- **Self-healing** — it resumes on its own when the dependency returns. Nothing is
  destroyed, so reactivating Pro or WooCommerce needs no repair step.

## Consequences

- **ADR 0012 is narrowed, not overturned.** Substitute [[Trigger]]s, drop Conditions —
  except Conditions marked `on_absence: suspend`.
- Suspension is the honest failure for this class: an Optin that does not show is a
  merchant asking *why*, which the list answers. An Optin that shows a false statement
  is a merchant not asking at all.
- The rule manifest gains a field, not a list. Any future Condition whose Optin copy
  depends on it sets the flag; nothing else changes.

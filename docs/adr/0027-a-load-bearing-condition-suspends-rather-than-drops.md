# A load-bearing condition suspends rather than drops

[ADR 0012](0012-degradation-substitutes-triggers-and-drops-conditions.md) drops a
[[Condition]] the install cannot evaluate, because *"dropping only widens the
audience."* That reasoning has a boundary, and this ADR draws it.

A Condition is **load-bearing** when the [[Optin]]'s copy asserts the fact it
guarantees. Dropping one does not widen an audience — it makes the Optin **say
something false**. Such a Condition carries **`on_absence: suspend`**, and an Optin that
holds one is not shown at all while the Condition is unavailable.

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
- **Visible** — the Optin list shows the state and its cause: *"Suspended — WooCommerce
  not active"*, *"Suspended — Pro not active"*. This is the screen a merchant actually
  looks at when something stopped working, which is what makes ADR 0026's silent goal
  screen acceptable.
- **Silent** — excluded from the published set, so it emits no impressions and no
  conversions. History stays clean and periods stay comparable: a suspended Optin
  contributes nothing rather than contributing zeroes against a live denominator.
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

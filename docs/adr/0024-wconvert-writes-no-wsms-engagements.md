# WConvert writes no WSMS engagements

WSMS ships `wsms_engagements` — a **core**, polymorphic, [[Contact]]-linked store
for *pending things about a person*, with an open producer registry. WConvert
neither writes to it nor reads from it, and this is a scope boundary rather than a
deferral.

## What the invitation looks like

It is easy to miss and easy to accept.
[#5](https://github.com/navidkashani/wconvert/issues/5) surveyed the WSMS
integration surface and never opened this table.

`EngagementServiceProvider` registers **unconditionally** — this is not premium and
not WooCommerce-specific. The schema comment describes "one polymorphic per-contact
state row per *pending thing*" (`Migrator.php:374-425`). Rows carry `status`,
`step`, `next_action_at`, `converted_at`, `variant`, `campaign` and `payload`, with
`UNIQUE(source, type, dedup_key)` making capture an idempotent upsert and an Action
Scheduler sweep driving follow-ups. `source` explicitly "keeps each consumer's key
space its own", and `EngagementType` is an open interface with three registrants
today: abandoned cart, back-in-stock, booking reminders.

A [[Lead]] with a `converted_at`, a follow-up schedule and A/B `variant`, for the
cost of one upsert, in a table built to be shared.

## Why writing is worse than it looks

An engagement **is** a per-person lifecycle: a status, a step counter, a
`reopen()`. That is precisely what `CONTEXT.md` defines a Lead as not having, and
what [ADR 0002](0002-leads-are-immutable-by-schema.md) enforced by removing every
mutable column from `wconvert_leads`.

Housing it in WSMS's table is **worse than housing it locally**, not better: the
drift becomes invisible to WConvert's own schema review. ADR 0002's guard is a
reviewer noticing a migration, and there is no migration to notice when the
lifecycle lives in another plugin's table.

It would also duplicate what already works. A Contact created by the push fires
`wsms_contact_created`, which is a Flow trigger
([ADR 0023](0023-the-wsms-push-fires-wsms-contact-events.md)) — so merchant-defined
follow-up already runs, built in the tool that owns follow-up.

## Why reading is impossible, not merely unwise

The more attractive direction is an engagement as a WConvert [[Condition]]: *show
this only to someone with an open abandoned cart.* It cannot be built under
decisions already made.

[ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md) fixes every Condition
as client-side. [ADR 0017](0017-no-visitor-identifier.md) leaves no visitor
identifier, so **the browser cannot say who it is** — and "has an open cart" is a
question about a person. Server-side [[Targeting]] cannot stand in, because its
output is baked into a page the full-page cache then serves to everyone
([ADR 0003](0003-published-set-projection-no-second-cache.md)).

WConvert already has the cart-state answer it needs: the cookie written on
`woocommerce_cart_updated`, which keeps the rule engine synchronous and pure and
requires none of this.

## Consequences

- `wsms_engagements` is out of scope for v1 and does not return unless the
  destination is redrawn.
- **[#19](https://github.com/navidkashani/wconvert/issues/19) inherits a real
  constraint**: "Recover abandoned carts" now has a WSMS *premium* implementation
  sitting beside it — consent gates, signed recovery tokens, a sequence compiler —
  and must be decided against that rather than in a vacuum.
  *Answered by [ADR 0025](0025-cart-recovery-captures-nothing.md): the overlap is
  **zero, and structurally so**. `AbandonedCartCapture` hooks only the two
  checkout identity paths plus a refresh, so WSMS cannot see a shopper who never
  reached checkout — which is exactly WConvert's visitor. The split is before
  checkout versus after identity, documented and never runtime-detected. The Goal
  is also renamed to **"Bring shoppers back to their cart"** and captures
  nothing: no form, no [[Lead]], no [[Destination]], one step.*
- A future WConvert feature that genuinely needs per-person pending state is a
  signal to re-read `CONTEXT.md`'s Lead entry, not a signal to register an
  `EngagementType`.

# Display rule engine

Type: grilling
Status: open

## Question

How are display rules modelled, and what are the evaluation semantics?

Settled already: rules evaluate **client-side**, from a per-URL JSON payload, so
that full-page caching works. That fixes where evaluation happens but nothing
about its shape.

Open:

- The rule schema. Flat list with implicit AND? Groups with AND/OR? Nested
  boolean trees? Each step up in expressiveness costs UI complexity and payload
  size, and the ceiling is hard to raise later.
- Which rules ship in v1, split across the free/premium line already decided
  (free: page targeting, time delay, scroll depth; premium: exit intent, device,
  referrer, geo, cookie/session, AdBlock).
- Trigger vs. condition — is "exit intent" the same kind of thing as "device is
  mobile"? Most competitors separate *when it fires* from *who is eligible*.
  Decide whether WConvert makes that distinction explicit in the model.
- Evaluation order and cost. Some rules are free to test (device), some require
  listeners (scroll, exit intent), some need network (geo). Cheap-first matters
  at the 15KB budget.
- Page targeting syntax on WordPress specifically: post IDs, post types,
  taxonomies, URL patterns, or all four.

Frequency capping and "already seen" state belong to
*Consent, privacy and retention* and the visitor-state half of this problem —
coordinate, do not duplicate.

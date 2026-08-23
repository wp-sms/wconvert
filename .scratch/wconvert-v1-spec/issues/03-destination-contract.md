# Destination contract

Type: grilling
Status: open

## Question

What is the interface a Destination implements, and how does a Lead get pushed
through it?

WSMS solves the adjacent problem with `IntegrationRegistry` plus capability
interfaces (`SupportsContactSync`, `SupportsListManagement`,
`SupportsSuppressionSync`, …). That pattern is proven in-house and worth
mirroring — but WConvert's needs are narrower, because data flow is strictly
one-way and it never reads Contact state back. Decide how much of that shape to
borrow and how much is overkill.

Open:

- The interface itself. What must every Destination provide beyond `push(Lead)`?
  Field mapping? A settings schema for the admin UI? A connection test?
- **Sync vs. async.** Pushing inline blocks form submission on a third-party API;
  pushing async needs a queue. WSMS uses Action Scheduler. Does WConvert take
  that dependency, roll something smaller, or push inline with a timeout?
- Failure handling. Retries, backoff, dead-letter, and what the visitor sees when
  the Destination is down but the Lead was captured. The local Lead log is a
  natural safety net here — decide whether it is always written or only as a
  fallback.
- Field mapping. Optin fields are user-defined; Destination fields are fixed.
  Where does the mapping live and how much of it is automatic?
- Multiple destinations per Optin: supported in v1? Partial failure semantics?

*ESP landscape for v1* supplies the concrete API shapes this contract must
accommodate; *WSMS integration surface* supplies the in-house one.

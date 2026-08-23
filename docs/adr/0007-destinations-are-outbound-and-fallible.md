# Destinations are outbound and fallible; the local Lead log is not one

`CONTEXT.md` originally listed "the local Lead log" as a Destination and defined
Standalone as "no Destination configured other than the local Lead log". The
storage and WSMS-integration decisions then made the local row **the capture
itself** — written first and always, before anything else runs. Both statements
could not stand.

Test the local log against every property the word Destination carries:
configured (no — it cannot be turned off), optional (no), one of several (no),
holds credentials (no), has a settings schema (no), can fail without the capture
failing (no — if it fails, capture failed), has delivery state (meaningless).
It satisfies none of them. Keeping it inside the contract would put a member in
the set that violates every invariant the other implementations rely on, and
`DestinationInterface` would grow methods that only ever have one honest
implementation: the null one.

**The glossary was wrong, not the contract.** A Destination is defined by being
**outbound and fallible**. The local Lead log is the *Lead store*.

The criterion was chosen over the obvious alternative — "a Destination is an
external system" — because the lead-magnet delivery email is outbound, per-Lead,
configurable and fallible, but is not external: it goes through `wp_mail`. Under
the external-system criterion it would have had no home, and the *Deliver a lead
magnet* Goal's declared metric ("Leads where the delivery fired") would have had
nothing to read.

## Consequences

- **Standalone is not "no Destination configured at all."** That wording would
  make a lead-magnet install non-Standalone, which inverts the intent. Standalone
  is *no Destination that depends on another system* — no WSMS, no ESP, no
  webhook. Capture, the Lead log, CSV export and the lead-magnet email all work
  with nothing else installed.
- **The local Lead row is never queued, never retried, and never has delivery
  state.** It is the precondition for dispatch, not a participant in it.
- "Destinations are the only way a Lead leaves WConvert" is now scoped to
  *automatic* pushes. CSV export is a manual admin action and always was a
  counter-example to the unscoped claim.
- **One-way is scoped to Contact state and the capture path**, not to all reads.
  WConvert never reads subscription status, list membership or suppression, and
  reads nothing at all while handling a capture — but it does read a provider's
  *shape* at admin time (audiences, custom fields, connection tests). All four v1
  ESPs require an audience id, and making the merchant paste one by hand is a
  support burden with no privacy benefit: reading the list of audiences reveals
  nothing about any person.

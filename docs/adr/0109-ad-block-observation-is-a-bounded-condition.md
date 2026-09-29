# Ad-block observation is a bounded audience condition

Accepted for implementation 2026-09-29 under the requested ad-block feature.
See [the implementation plan](../plans/ad-blocking/README.md) for the full
contract and verification matrix.

`ad_blocking` is a Pro Condition in Display → Audience. It observes selective
cosmetic hiding of a local bait element during a short visible-page window.
It detects interference, not an installed extension, and has four internal
states: pending, detected, not detected, unknown. Either authored status matches
only its corresponding settled state. Unknown matches neither. The probe is
created only where a served Campaign names it, uses no network request or
persistent storage, and cleans up its DOM and timers. A missing paid module
still suspends the whole Campaign; an available module with an inconclusive
measurement does not suspend independent audience alternatives.

This is a Condition because it answers who qualifies when the chosen Opening
moment occurs. A delay plus detected status is expressed by one audience leaf
and an existing timed Opening rule. No second opening mechanism or priority
exception is introduced. An early fresh gesture is not replayed after the
asynchronous check settles.

The Free inspector observes only two loader boot milestones, without exposing
Campaign IDs, decisions or visitor data. It may explicitly check the existing
beacon route with an empty event array; that request increments no counter. The
inspector distinguishes delivery evidence from the detector's result. The
browser beacon falls back once after `sendBeacon` refuses or throws, and flushes
queued events on page hide as well as `pagehide`. No ambiguous delivery outcome
is retried because counters have no event IDs for deduplication.

## Loader-size amendment

Before this change the measured gzip-9 sizes were 14,011 / 24,524 / 25,496 /
25,761 bytes for Free / Basic / Pro / Elite. The first complete feature build
measured 14,107 / 24,607 / 26,127 / 26,408 bytes. The final feature build
measured 14,107 / 24,607 / 26,142 / 26,421 bytes. The resulting hard caps are
14,336 / 24,832 / 26,368 / 26,624 bytes. The Free and Basic increase covers
boot observation and beacon transport; Pro and Elite additionally include the
lazy ad-block detector. Every cap remains a flagless failure in CI, with the
combined phone-page check using the same numbers. The phone asset, payload and
per-design caps do not change. Verification is recorded in the plan's
implementation evidence section.

This amends ADR 0048's loader-unaware inspector contract only for the two
anonymous boot milestones. It amends ADR 0104's display contract with this
optional bounded audience Condition and ADR 0029/0108's byte numbers. Their
inline notes point here.

# 0141: Claims share one sweep

Date: 2026-10-10. Status: accepted.
Amends [0119](0119-actionable-reports-use-local-evidence-and-order-provenance.md)
(when attribution claims are cleaned) and
[0121](0121-recommendation-additions-count-server-accepted-cart-actions.md)
(when cart claims are cleaned, and how long an interrupted lock lasts).

Before this, each short-lived claim (a click, an order receipt, a cart
operation, its headline, a session lock) scheduled its own WP-Cron event to
delete it. Every event lives in the one autoloaded `cron` option, which
WordPress reads and rewrites whole on every change. Measured on Local's MySQL:

- 1,000 outstanding claims grew `cron` from 4 KB to 185 KB. That is loaded on
  every request and rewritten (4.5 ms) on every claim.
- Under 20 concurrent writers, **250 of 500 events were lost** to that
  read-modify-write. Their claims were never deleted. Any other plugin's event
  scheduled in the same instant can be lost the same way.

## Decision

`WConvert\Pro\Claims::take()` is `add_option()` plus, only when none is pending,
one single sweep event (`wconvert_claims_sweep`). Scheduling it records a
**mark**: the highest `option_id` at that moment. The sweep runs no earlier than
an hour later, and deletes only claim rows at or below its mark. Every row it
removes therefore existed at least an hour, which outlasts every claim's window
(two minutes for a click, thirty plus one for the rest). If claims remain, the
sweep schedules the next one with a fresh mark.

The mark only moves when a sweep is scheduled. A sweep already pending keeps its
own mark, so a claim taken while it waits is never swept early.

Measured the same way afterwards: 1,500 claims (1,000 sequential, 500 across 20
writers) made **one** write to `cron`, which stayed at 4.3 KB. Two sweeps removed
all of them, 1,499 in 32 ms. `bin/verify-claims.php` checks the behaviour on
MySQL in CI and on SQLite in Playground.

## Consequences

- **Claims live one to two hours**, not until their own window plus a minute.
  They are inert after their window, so this changes only storage. ADR 0119's
  "short-lived anonymous receipt" still holds.
- **An interrupted cart lock blocks for longer.** If a request dies between
  taking a session's lock and releasing it, that session's WConvert additions
  are refused until the sweep: one to two hours instead of about thirty-one
  minutes. A normal request always releases the lock in `finally`.
- **The mark assumes `option_id` is never reused.** MySQL 8 and MariaDB 10.2.4+
  persist the auto-increment counter. MySQL 5.7 could reuse an id after a
  restart that followed deleting the newest rows, and a claim taken then could
  be swept before its hour.
- **Uninstall** unschedules the sweep and deletes the mark beside the claims.

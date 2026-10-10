# 0141: Claims share one sweep

Date: 2026-10-10. Status: accepted.
Amends [0119](0119-actionable-reports-use-local-evidence-and-order-provenance.md)
(when attribution claims are cleaned) and
[0121](0121-recommendation-additions-count-server-accepted-cart-actions.md)
(when cart claims are cleaned, and how long an interrupted lock lasts).

Before this, each short-lived claim (a click, an order receipt, a cart
operation, its headline, a session lock) was taken with `add_option()` and
scheduled its own WP-Cron event to delete it. Measured on Local's MySQL:

- **The cron option grew and lost entries.** Every event lives in the one
  autoloaded `cron` option, which WordPress reads and rewrites whole on every
  change. 1,000 outstanding claims grew it from 4 KB to 185 KB. That is loaded
  on every request and rewritten (4.5 ms) on every claim. Under 20 concurrent
  writers, **250 of 500 events were lost** to that read-modify-write. Their
  claims were never deleted. Any other plugin's event scheduled in the same
  instant can be lost the same way.
- **A claim was not atomic.** `add_option()` checks existence, then ends in
  `INSERT … ON DUPLICATE KEY UPDATE`. In 5 rounds of 20 concurrent requests
  claiming one name, **10 succeeded, not 5**: a race could credit twice.

## Decisions

1. **`WConvert\Pro\Claims::take()` is an `INSERT IGNORE`.** Exactly one
   request wins: 5 of 100 in the same test. It clears the option cache entries
   that `add_option()` would have maintained.
2. **One sweep event, ranged by a timed mark.** A claim schedules
   `wconvert_claims_sweep` only when none is pending. Scheduling records a mark,
   `{id, at}`: the highest `option_id` and when it was read. A sweep deletes
   claims at or below `id`, and only once `at` is an hour old. Before that it
   just puts itself back for that time. So every claim removed existed for at
   least an hour, which outlasts every claim's window: two minutes for a
   click, thirty for attribution, thirty-one for a cart token. It holds however
   the sweep is run: on time, twice by two cron runners, early from a cron
   manager's "Run now", or resurrected by another request's stale `cron`
   write. If claims remain, the sweep takes a new mark and schedules the next
   one.
3. **Core's daily cleanup also runs the sweep.** A lost sweep event is restored
   by the next claim. On a site that takes no more, `wp_scheduled_delete` gets
   round to the rest within a day.

Measured afterwards: 1,500 claims (1,000 sequential, 500 across 20 writers)
made **no** extra write to `cron`, which stayed at 4.3 KB with one sweep entry.
`bin/verify-claims.php` checks all of the above on MySQL in CI. It also passed
on SQLite in Playground, run by hand with Pro mounted.

## Consequences

- **Claims live one to two hours**, not until their own window plus a minute.
  Longer if cron is delayed or the sweep is behind (more than 10,000 claims an
  hour). They are inert after their window, so this changes only storage. ADR
  0119's "short-lived anonymous receipt" still holds.
- **An interrupted cart lock blocks for longer.** If a request dies between
  taking a session's lock and releasing it, that session's WConvert additions
  are refused until the sweep: one to two hours, not about thirty-one minutes. A
  normal request always releases the lock in `finally`.
- **The mark assumes `option_id` is never reused.** MySQL 8 and MariaDB 10.2.4+
  persist the auto-increment counter. MySQL 5.7 could reuse an id after a
  restart that followed deleting the newest rows, and a claim taken then could
  be swept before its hour.
- **Uninstall** unschedules the sweep and deletes the mark beside the claims.

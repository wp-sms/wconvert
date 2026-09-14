# Campaign setups explain handoff and format

Accepted 2026-09-14, completing the approved pre-release UX follow-ups to ADR 0085.

## Merchant language

The UI calls an Optin a **Campaign** and a Playbook a **Campaign setup**. A campaign
is an on-site form or offer, not a WSMS outbound send; the campaigns list says so.
Internal class names, routes, block identity, config keys and tables remain Optin
and Playbook. Smaller rule-only bundles are **Display rule sets**. A design remains
reusable structure, not a business scenario.

Bundled names describe jobs: Recommend a related article, Email a downloadable
guide, Request a quote, Cart reminder after a delay. PromoteOffer becomes **Promote
an offer or content**, measured by **Link clicks**, reflecting existing content
recommendations without implying purchase attribution.

Setup cards derive an expandable checklist from the actual design, format and
Outcome contract: copy, real coupon/link/resource, handoff, placement and rules.
This is guidance, not a claim that configuration is complete or a new taxonomy.

## Explicit collection choice

List Goals default to **Send to a service**. Publication requires a selected,
available audience Destination with completed required settings and a matching
`audience_channels` capability. MailPoet supports email; WSMS supports email and
phone. Transactional lead-magnet email does not qualify as an audience service.

**Collect only in WConvert** is explicit `config.capture_mode = local`. Selecting
it removes draft Destination ids in one undoable edit and explains manual export,
follow-up and reviewing visitor copy. `OptinBinding::ids()` also suppresses automatic
forwarding in this mode, including stale published bindings. Choosing a route sets
connected mode. The local log is not a Destination. Enquiries may stay local;
lead magnets still need delivery. Changing a draft does not cancel forwarding
already queued for an earlier capture.

These checks prove configuration, not confirmation, delivery, list growth or revenue.

## Reviewed format choice

The library has a visible Format selector. Browsing/cancelling never edits the
draft. Applying writes the prepared `template`, `template_id` and selected design's
`display_type` in one Undo entry. Keep/sample-content review and binding/A/B checks
remain. Saved rules are preserved; inline needs block/shortcode placement and does
not use overlay triggers to position itself. Review placement before publishing.

This amends ADR 0069's fixed gallery scope and completes ADR 0085's naming/format
follow-ups. No table, column, backfill or compatibility shim is introduced.

## Validation boundary

Tests cover default/explicit collection, audience channel matching, stale-binding
suppression, publication, format browse/cancel/apply and Undo/Redo. A separate
first-time-user test protocol is prepared, not run. Research evidence stays dated;
implementation status is separate from market signals and participant findings.

# Campaign setups explain handoff and format

Accepted 2026-09-14, completing the approved pre-release UX follow-ups to ADR 0085.

## Merchant language

The UI calls an Optin a **Campaign** and a Playbook a **Campaign setup**. A campaign
is an on-site form or offer, not a WSMS outbound send; the campaigns list says so.
Internal class names, routes, block identity, config keys and tables remain Optin
and Playbook. Smaller rule-only bundles are **Display rule sets**. A design remains
reusable structure, not a business scenario.

> _Amended by [ADR 0129](0129-display-rules-plain-questions-and-quick-picks.md): there are no Display rule sets any more. Their common answers are Quick picks inside each Display rules question._

Bundled names describe jobs: Recommend a related article, Email a downloadable
guide, Request a quote, Cart reminder after a delay. PromoteOffer becomes **Promote
an offer or content**, measured by **Link clicks**, reflecting existing content
recommendations without implying purchase attribution.

Setup details derive an expandable checklist from the actual design, format and
Outcome contract: copy, real coupon/link/resource, handoff, placement and rules.
**Amended by [ADR 0087](0087-choices-first-details-on-demand.md):** cards show a short
format/timing summary; full facts and checklists move into optional Setup details.
This is guidance, not a claim that configuration is complete or a new taxonomy.

## Explicit collection choice

List Goals default to **Send to a service**. **Amended by
[0132](0132-every-screen-answers-its-first-question.md):** only when the site
already has a ready service of the Goal's channel; otherwise creation writes
`capture_mode = local`, and Review & publish and Destinations offer "Keep leads
in WConvert for now" beside the remaining blocker. Publication requires a selected,
available audience Destination with completed required settings and a matching
`audience_channels` capability. MailPoet supports email; WSMS supports email and
phone. Transactional lead-magnet email does not qualify as an audience service.

**Collect only in WConvert** (*renamed **Keep in WConvert only** by [ADR 0131](0131-one-way-to-show-each-thing-in-the-admin.md)*) is explicit `config.capture_mode = local`. Selecting
it removes draft Destination ids in one undoable edit and explains manual export,
follow-up and reviewing visitor copy. `OptinBinding::ids()` also suppresses automatic
forwarding in this mode, including stale published bindings. Choosing a route sets
connected mode. The local log is not a Destination. Enquiries may stay local;
lead magnets still need delivery. Changing a draft does not cancel forwarding
already queued for an earlier capture.

These checks prove configuration, not confirmation, delivery, list growth or revenue.
**Presentation completed by [ADR 0088](0088-handoff-state-and-required-fixes-lead-the-review.md):**
mode descriptions are brief, selected-route removal is explained before switching,
and the list/review explicitly identify incomplete service setup rather than
describing it as manual export. The collection and publication contracts above remain.

## Reviewed format choice

The library has a visible Format selector. Browsing/cancelling never edits the
draft. Applying writes the prepared `template`, `template_id` and selected design's
`display_type` in one Undo entry. Keep/sample-content review and binding/A/B checks
remain. Saved rules are preserved; inline needs block/shortcode placement and does
not use overlay triggers to position itself. Review placement before publishing.
**Amended by [ADR 0087](0087-choices-first-details-on-demand.md):** filtering is an
optional panel, and format-change guidance appears at design review beside Apply,
not in a permanent explanatory strip above the gallery.

This amends ADR 0069's fixed gallery scope and completes ADR 0085's naming/format
follow-ups. No table, column, backfill or compatibility shim is introduced.

## Validation boundary

Tests cover default/explicit collection, audience channel matching, stale-binding
suppression, publication, format browse/cancel/apply and Undo/Redo. A separate
first-time-user test protocol is prepared, not run. Research evidence stays dated;
implementation status is separate from market signals and participant findings.

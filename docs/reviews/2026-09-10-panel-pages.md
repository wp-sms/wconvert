# Reading-page review — 10 September 2026

Implemented under [ADR 0068](../adr/0068-reading-pages-put-results-and-routes-before-occasional-settings.md).
The scope is Optins, Analytics, Leads and Destinations. WConvert's capture and
handoff ownership stays as documented in CONTEXT.md.

## What changed

The pages share quieter navigation, clearer title/action alignment and an
80rem reading measure. Optins gains search and status filters that keep an A/B
family intact. Analytics places Goal results and daily charts first, with exact
daily numbers and Optin breakdowns available on demand. Leads shows names and
expandable captured details, with stable grouping/export state during requests.
Destination cards emphasize target and health; Settings preserves edits when
folded and Cancel restores stored values and keyboard focus. Re-push is
immediately available for failing routes and otherwise sits with Settings.
Frequency and retention settings show their saved state while closed.

Browser review found and repaired clipped table actions at 641px, the incorrect
WordPress mobile gutter, cramped phone numbers and reordered timestamps in RTL.
Tables use labelled card rows at 900px and below. Milestones also avoid claiming
nothing was published when later impressions or conversions prove otherwise.

## Evidence

- Real WordPress admin: populated Optin list, search/status/clear-filter flows,
  date and Goal filters, existing MailPoet route summaries, Settings edit/Cancel,
  Add destination type disclosure, empty Lead log, retention disclosure and
  reopening the existing unpublished editor draft.
- Responsive WordPress checks: 360px, 641px, 901px, 1024px and normal desktop.
  After the fixes, measured table actions fit their cells and tested reading
  screens have no horizontal page overflow.
- A disposable local fixture preview rendered the shipping Analytics and Leads
  components with sample data. Checked populated charts, daily-number tables,
  expanded captures, grouping, empty/loading/error states and RTL at 360px.
  Its requests were intercepted locally; it had no delivery backend. This is
  visual coverage, not evidence of an actual capture or provider delivery.
- Frontend suite: 1,872 tests passed. The final RTL markup was followed by all
  19 Lead-log tests. TypeScript, ESLint and Free/Pro admin builds passed.
  Source contract and Goal parity passed (2 PHP tests, 629 assertions).

No Optin was published, no retention setting was changed, and no destination
test or re-push was sent during this review. Temporary destination-name edits
were cancelled and the stored value verified. No schema or field type changed.

## Next product check

Completed in subsequent work: the [lead journey](2026-09-11-lead-journey-qa.md)
verified actual capture, queued MailPoet acceptance and local mail transport;
the [library review](template-library-curation-2026-09-11.md) checked newsletter,
coupon, resource and callback visitor flows. External inbox receipt, physical
devices and complete accessibility certification were not established. The
[audit closeout](audit-closeout-2026-09-14.md) separates those limits from open work.

The original next-check brief was: walk one representative offer through choosing a design, changing its copy,
choosing where it appears, collecting a test Lead and confirming delivery in a
named receiving service. This requires a designated test recipient before the
send. Broader Browse designs comparison, field capabilities, template fidelity
and manifest improvements remain separate work described in the merchant
journey review; this panel pass does not claim to complete them.

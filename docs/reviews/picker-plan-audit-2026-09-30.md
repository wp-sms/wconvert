# Picker plan and prototype audit — 30 September 2026

The local picker works, but the full eight-slice programme is not complete. This
review corrects the earlier broad “slices 1–4 implemented” status and compares
real code/output with the plan and approved prototype A. No CI, merge,
deployment or real email/SMS delivery was performed.

## Changes from this audit

- Collection browsing, exact setup inspection and two-design comparison use one
  dialog. Back preserves collection stage, chosen use case, scroll and focus;
  Escape closes the dialog and returns to the invoking control when it remains
  mounted, otherwise to the library's Collection selector.
- Inspector use-case selection updates the prepared design, requirements,
  visitor guidance and exact draft action together. Mobile selection remains;
  switching to a shorter journey cannot inspect an out-of-range screen.
- Collection stages count available matching entries. Filtering away a selected
  stage explains the fallback, selects a nonempty stage and disables empty ones.
  Formats are scoped to the collection; ended open occurrences explain reuse.
- Shelf arrows hide when content fits and disable at either end, including RTL
  and scroll-snap padding. Keyboard scrolling and Browse collections remain.
- Authenticated preferences can hide/restore the whole featured shelf. Browse
  collections remains usable, including while search or Saved filters are active.
  Preferred businesses rank collections without removing other matches.
- Help me choose refines business and placement without changing the chosen Goal.
  Name A–Z is available alongside the existing recommendation order.
- Reviewed English search aliases cover quote/estimate, bar/banner,
  enquiry/inquiry and signup/subscribe. Localized verbatim search remains;
  a full translated alias dictionary is still editorial work.
- Previews are centered; phone controls and toolbars wrap. Counts use correct
  singular/plural labels. Settings checkboxes retain sensible native dimensions.
- Studio simulations use the updated model and clear old screen proofs when
  their context changes. Internal tools remain excluded from shipped packages.

## Implementation slices

| Slice | Current status | Evidence or remaining work |
| --- | --- | --- |
| 1. Contracts and coverage | Local contracts and inventory delivered | Stable canonical identities, exact revision references, source/editorial membership separation, date policy, three business groups and availability fixtures. [Coverage matrix](picker-coverage-audit-2026-09-30.md): 133 registered setups / 70 referenced designs; 24 untagged. Optional industries need reviewed examples before exposing filters. |
| 2. Real local picker | Local creation and replacement paths delivered | Actual Prefill previews, grouping after filters, exact use-case selection, all screens/results, helper, comparison, stars, navigation and failure recovery. Replacement preserves existing content review, Goal-fit guidance, Show all designs and Undo. Comparison and A–Z currently belong to creation discovery; they are not a new replacement workflow. |
| 3. Preferences and occasions | Local storage delivered | Authenticated, blog-scoped user meta and non-autoloaded site options, bounded lists, strict shelf boolean, revision/lease conflicts and restore controls. No new tables. Find ideas uses the selected Goal; richer explicit occasion-stage matching needs curated task metadata. No date is applied to a campaign. |
| 4. Collection rules and studio | Runtime rules and reviewed seeds delivered; simulator partial | Five collections reference 16 current approved setups. Source/renderer/evidence changes invalidate reviews. Studio simulates date, business, Goal, format, Free/Pro, market and direction. Dedicated dependency, locale, timezone and offline/broken-asset simulator controls remain pending. Real WordPress resolves actual availability. Black Friday remains adaptable guidance, not a branded seasonal copy pack. |
| 5. API discovery and assets | Reader delivered; publishing/distribution partial | Schema 2 bounded immutable page reader, hash/release/origin validation and atomic last-good cache. Existing explicit refresh/install remains. Hosted endpoint, schema 2 publisher, remote setup/collection query service, licensed media cache/import and paid-download entitlement remain pending. Current local metadata reads the selected Goal's index; 24-card pagination is client-side, not a new server discovery cursor. |
| 6. Identity and resilience | Identity/update safety delivered; retention pending | Canonical favorites survive pack revisions, immutable baseline IDs remain, retired favorites stay named. The 128-file archive cap refuses more installs safely. Referenced-version cleanup/retention and a hosted release rollback rehearsal are not implemented. |
| 7. Release rehearsal | Local functional/build checks delivered; rollout study pending | 500-entry metadata fixture proves 24-card/lazy preview bounds. This is not the proposed one-second/200-ms browser benchmark. Native zoom, assistive-technology audit, five-merchant observation and a development rollout switch remain pending. Current rehearsal uses the development branch and disposable WordPress. |
| 8. Reviewed expansion | Pending | No new batch added by this picker work. Pilot: 108 setups / 59 designs; design index: 91 designs. Only 16 pilot setups have current approvals; the other 92 remain stale. Re-review/revise them, then author batches from evidenced needs rather than clone quotas. |

## Prototype details and scenarios

| Detail or scenario | Production result / explicit boundary |
| --- | --- |
| Goal/business/format discovery | Goal-first entry retained; optional business/placement helper; clear removable filters. The prototype's all-goal mock entry and hard email-only replacement restriction intentionally do not ship. |
| Stars | Per-user/per-blog WordPress data, shared with layout selection. Not browser-only storage or customer data in the studio. Retired entries are removable. |
| Repeated design with different tasks | One card per canonical design + effective format after filtering. Card and inspector selectors use exact current matching setup IDs. Copy changes are not new designs. |
| Collection → preview → Back | One dialog, same stage/use case, restored scroll and usable focus fallback. All collections → collection → All collections returns to the prior list. |
| Compare two | Inspection only; two actual screen explorers, responsive columns, requirements and exact setup review before draft creation. No analytics/conversion claim. |
| Seasonal recommendation | Date/market/availability/user preferences determine relevance. Small manual shelf; no rotation or automatic scheduling. Empty shelf omitted; all-collections empty state offers recovery. |
| Event ends while detail is open | No forced closure; expired placement disappears, open detail explains reviewing new dates/terms. Installed setup and existing campaigns survive. |
| Custom date range | Inclusive end and site timezone, shared with site managers. Planning metadata only; editing/deleting cannot reschedule a campaign. Richer stage-specific recommendations are pending. |
| API failure / bad response | Installed/local content remains usable. Atomic validated refresh retains last-good cache. Uninstalled uncached content needs explicit connection/install; no paid bypass. |
| Preview fails or exact bytes change | Retry/reload is explicit. Preparation checks source and prepared revisions and refuses substitution. No silent second draft after an uncertain create response. |
| Layout replacement | Existing mapping review and Undo remain authoritative. Collections, occasions and setup creation never replace campaign content through this flow. |
| Artwork | Current collection covers use original code decoration; design thumbnails use the shipping renderer. Remote image assets/rights/digests need the planned media extension; no external URL injected into an old pack. |
| Internal studio | Repository tooling and simulated authored examples, no customer account/Lead access. It is not yet a hosted team administration service or API publisher. |

## Guidelines checked

Reviewed root CLAUDE.md, domain CONTEXT.md, ADR 0112,
[the written admin guidelines](../../tools/design-system/GUIDELINES.md) and the
React performance skill. New one-of-N controls use shared native radio strips;
card refusal reasons remain focusable and announced. Typography, neutral
surfaces, shared tier names and scope-owned control sizes follow the guidelines. Existing registries, preparation, renderer, form/phone components,
capabilities, management permissions and draft/publication paths remain the
sources of truth. ADR 0112 and the plan are amended alongside this audit. No
new table/column, second builder, remote telemetry, background catalog contact,
external delivery, campaign rewrite or pricing policy is introduced.

## Verification

- Full Vitest: **3,486 tests passed** in 192 files after the final behavior
  changes. New tests exercise exact use-case creation, one-dialog collection
  return, stage fallback, comparison, focusable refusal and shelf ends in LTR/RTL.
  The final radio appearance change is CSS-only; admin stylesheet checks passed.
- Full PHPUnit: **2,377 tests passed**, 14,228 assertions. Strict shelf preference
  validation is covered. PHPStan, TypeScript, ESLint and source contract passed.
- Fresh Free/Pro admin builds passed. Vite still reports the existing large
  builder chunks and JourneyTest's overlapping static/dynamic import; this audit
  does not claim those performance warnings resolved.
- Collection rebuild/gate: **5 current approved collections**. Studio: **21
  tests passed**. Free, Basic, Pro and Elite artifacts rebuilt and passed their
  contracts, excluding tools/prototype/review artifacts. No review hash was
  bypassed or stale setup silently approved.
- Native WordPress **7.1.2 / PHP 8.5.10** route/capture verification passed again:
  [record](picker-plan-audit-native-2026-09-30.txt). Auth, user isolation,
  revision conflicts, exact setup preparation and realistic native input checks
  are covered; provider delivery is explicitly excluded.
- Final actual collection modal measured at 318/388/766/1278 CSS pixels,
  with matching document widths and no detected control/dialog overflow. Narrow
  RTL adds one pixel of document rounding; 200% CSS magnification retains usable
  controls. Search fields measured 48px in both library and collection. See
  [measurements](picker-plan-audit-responsive-2026-09-30.json). This is a scoped
  review, not native browser zoom or a full assistive-technology audit.
- Native radio arrow navigation changed Desktop to Mobile and kept focus on the
  chosen input. Switching use cases preserved mobile selection; Back restored
  the updated setup detail control, same stage and one dialog. Escape closed the
  dialog and restored a usable library fallback. Actual templates and
  acknowledgement screens were visually inspected without submission.
- The final portal radio styling measured native appearance, 16px dimensions
  and the shared teal accent. Hiding the featured shelf left Browse collections
  available; the preference was restored and its saved checked state verified.
- Measured control colors: `#74877d` input edge on white **3.82:1**,
  `#1e1e1e` normal text **16.67:1**; shared muted `#53675e` **6.05:1**,
  primary `#205c57` **7.69:1** on white. These values do not certify arbitrary
  artwork or merchant copy. The visitor-template contrast evidence remains the
  separate renderer-bound review of 16 setups.
- Browser proof: [actual inspector](picker-plan-audit-2026-09-30.png).

## Next order

1. Finish the local release acceptance gaps: timed 500-setup browser benchmark,
   native zoom/keyboard/accessibility review, fuller studio failure contexts and
   merchant task observations. Keep the current draft PR reviewable.
2. Re-review stale pilot entries and curate better custom-occasion/seasonal task
   metadata. Expand SMS/service matches and genuine unmet needs from the matrix.
3. Complete the immutable publisher/staging service and referenced-version
   retention before broad API rollout. Connect paid entitlement/media only when
   their real contracts and provenance are supplied.

# Production template picker implementation — 30 September 2026

## Delivered

Picker A now runs in the actual plugin, rather than only the prototype. Existing
Goal-first creation browses searchable, filtered design groups with a use-case
selector, authenticated personal stars and bounded lazy Prefill previews. Search
and neighboring buttons share a 48px height. Creation details inspect every
screen and result at desktop/mobile widths, expose requirements and include the
existing local visitor-journey simulation. Revision guards refuse stale source
or site-prepared previews before creating a draft.

The layout replacement picker has canonical stars and pagination while retaining
content-transfer review, Goal fit, Show all designs and undoable application.
Collection/settings views preserve library navigation. No new builder, campaign
schedule, automatic publication or existing campaign rewrite is introduced.

Five reviewed collections are generated from exact references to 16 freshly
reviewed setups: sale planning, collection launches, service enquiries, reader
relationships and adaptable Black Friday preparation ideas. Featuring considers
active filters, site dates, selected markets, availability and personal hiding.
Exact matching setup/design counts and before/during/after navigation avoid
presenting shared designs as new compositions. Seasonal expiry does not change
an open inspection or saved campaign. Site dates advance locally without a
background catalog refresh, including while offline.

Site occasions are shared planning names/dates. Stars and recommendation
preferences belong to the authenticated WP user on the current blog. Both use
bounded revisioned documents and conflict handling, without new tables. Named
retired favorites remain removable; installed pack updates retain canonical
identity and immutable old baselines.

The internal collection studio and source/review workflow remain in excluded
repository tools. Runtime seeds and translated labels ship to customers. The
schema 2 remote reader validates immutable pages and exact pack references
atomically before replacing cache; ordinary browsing continues using local data.
See [ADR 0112](../adr/0112-template-discovery-and-reviewed-collections.md) and
[the API protocol](../template-discovery-api.md).

## Verification

All verification ran locally; no CI job or real email/SMS delivery was requested.

- Full JavaScript suite: **3,477 tests passed**, 190 files.
- Full PHP suite: **2,376 tests passed**, 14,208 assertions; subsequent canonical
  identity regression also passed (3 tests, 74 assertions).
- PHPStan: all 522 files passed. ESLint and TypeScript passed.
- Studio checks: **21 tests passed**, including changed review evidence,
  duplicate designs, publication refusal, stale runtime snapshots and retirement.
- `templates:collections:check`: all five published collection revisions passed
  against fresh renderer-bound setup and collection review records. The release
  build runs this gate before staging. Its read-only exporter also passed from a
  clean source layout without a developer `vendor/` directory.
- Full production asset build passed. Free, Basic, Pro and Elite installable ZIPs
  passed artifact contracts; source contract also passed. `/tools` remains excluded.
- Native disposable WordPress **7.1.2 / PHP 8.5.10** booted both plugins and served
  the real REST endpoints. Guest access refusal, private stars, two-user isolation,
  revision/lease conflicts, occasion validation, 24-preview bounds, exact Prefill
  snapshots and all 16 forms' realistic server validation passed. Existing
  campaigns stayed untouched. See the pinned [native evidence](picker-wordpress-2026-09-30.txt).
- Actual WordPress UI: collection cards and matching counts; all-screen inspection;
  a local email journey reached its acknowledgement without sending or tracking.
  Search/Saved/occasions buttons measured 48px. Native journey checks validate
  capture contracts and inputs, not external provider delivery.
- Real admin iframe viewports measured 318, 388, 766 and 1278 CSS pixels (two pixels
  below the outer 320/390/768/1280 frame sizes). No detected admin content overflow
  beyond intentional shelf/preview scrolling; RTL at the narrow width added one
  pixel of document rounding. 200% CSS magnification was checked, **not native
  browser zoom or a full accessibility audit**. See [measurements](picker-responsive-2026-09-30.json).
- Selected setups: 30 prepared screens, 480 size/direction cases, no audit failures.
  All paired screenshot groups were visually inspected. Contrast measurement
  includes field boundaries and text; it does not certify arbitrary merchant edits
  or image overlays. See [scoped design review](picker-collection-setups-2026-09-30.md).
- Collection date/business/plan/stage scenarios include 30 September, 16 October,
  Black Friday and 1 December; filtering to no available matches hides empty
  shelves. See [context checks](picker-collections-context-2026-09-30.md).

## Practical limits and next integrations

The library remains 108 pilot setups using 59 referenced designs, within 91
indexed designs. This task adds discovery infrastructure, not a new batch or a
claim of 300–500 completed campaigns. Only 16 setup approvals are current here;
92 older approvals remain stale after earlier renderer changes. The full-library
review gate therefore cannot yet certify all 108. The scoped collection gate
passes without overriding or silently approving those stale entries.

A schema 2 publishing service, hosted endpoint, paid-download authentication,
licensed artwork import and archive retention policy still need separate work.
The existing 128-file archive cap safely refuses more installs; nothing deletes
historical baselines. No live customer conversion study, 500-item performance
benchmark or provider inbox/phone delivery has been performed.

Markets currently use explicit country codes and three broad business groups.
Industry expansion should follow reviewed useful examples and search needs;
it is not a new Goal or design-eligibility taxonomy. Black Friday entries are
adaptable campaign ideas, not a completed branded seasonal pack. Existing draft
and published campaign snapshots remain independent of future template changes.

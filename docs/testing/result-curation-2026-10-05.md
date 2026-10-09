# Category result curation — local verification

2026-10-05. Implements [ADR 0126](../adr/0126-category-results-support-explicit-curation.md).
Local verification only; not a published release or production-scale performance claim.

## Automated checks

- Full PHP suite: 2,569 tests / 15,813 assertions passed. Two subsequent
  capability/portability tests also passed in the five-test PackValidatorJourney suite.
- Full JavaScript suite: 216 files / 3,800 tests passed.
- After final picker button/layout refinements: all seven result-filter UI tests,
  TypeScript and ESLint passed.
- PHPStan with 1 GB memory, source-contract verification and `git diff --check` passed.
- Free and Pro admin builds passed under Node 22.23.3. Vite retains its existing
  large-chunk advisory. No visitor loader source or budget changed.

## Real disposable WordPress/WooCommerce

WordPress 7.1.2, PHP 8.3.33, WooCommerce 11.1.2, classic fixture theme.
Commands run against the in-memory site on port 9445:

- `check-result-curation.mjs`: six grouped checks passed. Eighteen products exceed
  the ordinary twelve-candidate window: newest and price sort before limiting,
  distant pins take authored priority, twelve exclusions still permit later matches,
  and exclusions beat pins. Category/attribute mismatch, unavailable/private/deleted
  pins, empty matches and malformed rules remain safe. Saved and published settings
  produce the expected cards; excluded and subsequently sold-out products cannot be
  added via protected cart actions. Both warning adapters identify missing pins,
  with recovery after restocking.
- `check-quiz-products.mjs`: eighteen existing guest/authenticated checks passed,
  including cart replays, stale stock/price, published revision, product activity
  and no second quiz conversion.
- `check-product-health.mjs`: eight grouped checks passed.
- `check-result-filters.mjs`: eight grouped checks passed.

The links-only health test explicitly publishes link actions before removing the
commerce adapter; cart actions correctly require that adapter. Test data stays
in the disposable site. These checks do not replace the existing broader release
matrix for themes, extensions, Blocks and supported older WooCommerce versions.

## Local demo and visual check

Coffee finder editor: `01M45PA77YJQWXDQ1QTMP97MH9`, result “For your next brew”.
Saved as a draft: price low-to-high, reusable coffee filter pinned, brewer excluded.
Live preview shows the filter and omits the brewer. Reload confirmed persistence.
Corrected this old demo's invalid 1,000-per-session value to the allowed 100 so
that it could save. The previous published version remains live.

Reviewed desktop, expanded settings and 320 × 900 phone layout. The selected-screen
panel measured 319 px client width and 319 px scroll width. Names and controls wrap,
buttons use the shared component, and a single selection hides unused reorder
buttons. Temporary viewport override was reset.

## Admin guideline review follow-up

Reviewed against `tools/design-system/GUIDELINES.md` and ADRs 0036, 0037,
0042 and 0097, including their amendments. Covered category/attribute/order
selectors, pins/exclusions and hand-picked product controls, current product
warnings, and product activity report structure.

Corrections:
- Removed competing filter rules from the shared stylesheet (including help
  text assigned the 9px caption role). The editor owns one grid rhythm, with
  zero child margins and disclosure body spacing.
- Shared Button/Input components now handle retry and search actions. Ordinary
  controls use default sizing, with readable body-sized selector values.
  Scoped picker action styles avoid altering the standalone commerce picker.
- Pin/Exclude labels identify the action. Search works with Enter, announces
  no matches, explains a full selection and provides an in-place retry.
  Query changes cancel and ignore stale results. Failed product-name reads
  keep the selection and offer Retry names.
- Product warning cards use a 16px heading, warning color, container-owned
  spacing and a naturally sized Review products action.

Verification: full JS suite passed (216 files / 3,805 tests); TypeScript,
ESLint, both Node 22 admin builds and source-contract checks passed. Real local
WordPress browser review confirmed 36px search fields/buttons, 13px help text,
14px checkbox/radio labels and 18px drawn checkbox/radio controls. Editor and
warning panels fit at 320px (client/scroll widths 319/319 and 236/236 respectively).
Keyboard search, empty results and Escape dismissal were exercised. Product
activity was visually checked in its real current empty state; populated and
failure states are covered by the existing component suite. No campaign content
was saved or published during this review. Viewport overrides were reset.

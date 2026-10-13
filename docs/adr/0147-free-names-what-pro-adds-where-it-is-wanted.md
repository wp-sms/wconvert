# 0147: Free names what Pro adds where it is wanted

Date: 2026-10-13. Status: accepted.
Amends [0015](0015-enforcement-is-by-non-registration.md),
[0029](0029-the-free-contract-is-proven-at-the-source.md),
[0106](0106-question-journeys-extend-the-paid-loader.md),
[0116](0116-free-shows-nothing-it-cannot-run.md) and
[0146](0146-pro-is-one-tier.md), and GUIDELINES §8 and §14.

An audit of the free ZIP found two problems. First, free's admin bundle still
carried Pro's journey editors — questions, results, "Only if…", answer lines,
the branching add-screen dialog — behind `wconvert_journeys`, a filter only Pro
adds. That is a feature switched off in free's own code, which is what
wp.org's Guideline 5 (trialware) describes, and it made the readme's "None of
that code is in this plugin" untrue. Second, free's copy still leaked Pro: a
padlock and "comes with WConvert Pro" on the Flow map, "or upgrade" in the
journey notice, a Pro-only docs link on suspended campaigns, "a matching
plan" in design transfer, and Pro features in Help's searches.

ADR 0116 answered upsells by hiding everything: free named Pro only in the
header link and one Settings list. A merchant hunting for exit intent learned
nothing where they looked. This ADR keeps 0116's rule that a locked feature is
never drawn, and adds one line of text where the missing feature would sit.

## Decisions

**1. Journey authoring is Pro's code, in Pro's bundle.** Free's
`resources/admin/src/journeyAuthoring.ts` is a seam with two slots: `question`
(the element inspector's question settings) and `useAuthoring`, a hook the
screens editor calls with a `JourneyEditorContext` — the draft, where the
panel is, and the editor's own moves. Pro's `pro/modules/journeys/admin/`
fills both from its admin entry, eagerly (a repair focuses a condition on the
next frame; a lazy chunk would leave nothing there). Free renders none of it.
`journeysSupported()` and `wconvert_journeys` stay the server's word on whether
the module shipped. An empty slot while the flag is true is a build bug, and
`pro/tests/js/journey-authoring.test.ts` catches it.

Free keeps linear screens, the read-only Flow map, the neutral repair notice,
and two ways out of a journey draft it cannot publish: **deleting** its result
and question screens (the rules on removed answers go with them), and **"Make
it a straight campaign"**, one undoable edit that drops the graph, lines,
conditions, results and question-only screens, or says why it can't (nothing
or more than 7 screens left). A graph draft needs the second: the `graph` key
alone is a Pro element to `CaptureJourney::requiresPremium()`.

**2. The absence is proven on every pull request.** `bin/check-admin.mjs`, a
program of its own beside `check-loader.mjs` (ADR 0029: one per condition, no
flags), scans free's built `public/admin/**` and `public/inspector/**` for each
module's `admin_markers` in `module.json` — strings its admin code carries and
free's never does — and for the word "upgrade". It does not run the
premium-identifier scan: the hints below name Pro's rule types on purpose.
Nor does it scan for the product name, which `tierProductName()` builds at
runtime. It fails on `main` as of `aeef6f95`.

**3. Contextual hints, under eight rules.**

1. **Free installs only.** A Pro install supplies every member (ADR 0146).
2. **Only for people who can act on it:** the user can `install_plugins`. A
   multisite site admin, or a client given `manage_options`, sees none.
3. **Text, never a control.** One plain line at the end of a list: no
   padlock, no greyed item, nothing selectable, no modal, no badge or count,
   never blocking a task.
4. **At most one visible at a time.** A menu's hint exists while its menu is
   open. The format picker's sits in the design browser, a modal, so it never
   shares a viewport with the Flow map's. Never in the dashboard, the Plugins
   screen, the block editor, admin notices, the front end or the inspector.
5. **Bundled copy, no remote call.** Links carry fixed UTMs only (G7).
6. **Names come from data, not copy.** Rules from the `locked` members the
   menu already holds; destination services from `tiers.json`'s
   `destinations` (Pro's types are not registered on a free install, so the
   registry cannot name them — `TierManifestTest` keeps the list in step with
   each Pro type's `label()`); formats from `DISPLAY_TYPES`
   minus the free ones; the product from `tierProductName('pro')`; joined by
   `Intl.ListFormat` in the admin's locale. A feature that becomes free drops
   out without a copy edit. Two placements name one feature with no list to
   read it from — the Flow map's "Quizzes that branch on answers" and the ⋯
   menu's "A/B testing" — so those are fixed phrases, but each still shows
   only while its feature is absent (no journey authoring registered; the
   `variants` availability `locked`).
7. **Absence after Pro is removed still names no product** (0116 §3). Repair
   states and hints are different things.
8. **On by default.** `add_filter('wconvert_show_pro_hints', '__return_false')`
   removes the hints for agencies and white-label builds. The header link and
   the Settings list are not hints and are not affected.

The server decides: `ProHints::shown()` (rules 1, 2, 8) arrives as
`wconvertAdmin.proHints`; absent reads as no.

**4. The approved shape** (prototype claude.ai/artifact/8QaXatDqmDbHk3AkWVfEqh,
shape B): *"Also in WConvert Pro ↗: About to leave, Scrolls back up, Clicks a
button or link."* No icon of any kind. The link names its destination, opens a
new tab, says so to a screen reader, and its ↗ mirrors right to left.

| Surface | Where | `utm_medium` |
|---|---|---|
| Add rule menu | the list menu's `footer`, outside the arrow-key list | `rule-menu` |
| Format picker | under the design browser's Format select | `format-picker` |
| Flow map | after "Every visitor sees these screens in order." | `flow-map` |
| Destinations | below the provider tiles | `destinations` |
| Campaign ⋯ menu | the last row, an `OptionItem` link with no feature icon | `campaign-menu` |

The header link is `header` and the Settings list `settings-list`. The
downloads link carries none: it serves people who already bought.

**5. Pro installed but inactive** (`ProHints::proInstalledInactive()`: Pro's
file in `get_plugins()`, the user can `activate_plugins`). The hint, the header
and More with Pro say Pro is installed and *"Activate it"* — the header in
those words, the hint as *"Also in WConvert Pro, which is installed: a, b.
Activate it"*, keeping its list — and link
`plugins.php`, in the same tab, so without ↗.

## Consequences

- `ProHint` and `ProHintItem` (`shell/ProHint.tsx`) are the only way a hint is
  drawn; a new placement passes a `ProMedium` and its feature names.
- Content lock stays a pass-through so saved posts read cleanly; there is no
  lock in free.
- Suspended campaigns carry `suspended_needs` (the missing plugin, or null) so
  "What to check" links the WooCommerce docs topic, and the Pro guide only
  where Pro is installed.
- "Why no popup?" appears in the admin bar only once a campaign is published.
- Rejected: a padlock or premium icon on the line. In this admin grey + lock
  means a `locked` item, and an item-shaped upsell is what a reviewer reads as
  trialware.

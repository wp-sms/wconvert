# Campaigns use a design-led workspace and compact masthead

**Visual frame superseded by [ADR 0097](0097-harbor-is-the-shared-admin-frame.md).**
The campaign workflows and data contracts below remain in force. The 56px white
masthead and earlier visual measurements are historical.

The approved Campaigns prototype supplies the management hierarchy and interactions.
**Amended after guideline review:** production uses the shared design system;
prototype measurements do not establish exceptions to it. The
shared desktop masthead is 56px, with a compact WConvert mark, installed tier,
underlined text navigation, Help, Notifications and an account icon. Narrow
screens put navigation on a second row. WordPress keeps its own toolbar.

## Campaign management

The default list has four columns: Campaign, Status, Results and Next action.
Saved-design thumbnails and campaign names open a detail dialog; the explicit
next action opens the editor or explains a suspension. Gallery shows the same
campaigns and actions. Search and status filters keep A/B families together;
counts and pagination (12 parents per page) count families. Variants are
indented and collapsible. Sorting is newest ID first or name, not a claim about
last-edited time: the schema has no updated timestamp.

The anchored 224px row menu uses grouped icon actions and stays non-modal, so
opening it does not lock scrolling. Preview, reports and capture history lead;
duplicate, A/B and visibility tools follow. Unpublish/publish/winner actions are
separate from deletion. Destructive and publishing decisions are confirmed.
Duplicate copies the saved config through the validated creation route and
opens the resulting draft. A/B uses its existing endpoints and availability.
An in-flight write disables its campaign family, because winner and variant
actions share family state. Unrelated families remain actionable. Navigation and
actions that open a new draft wait for pending writes; a created draft opens
after the final write releases the guard, unless an unresolved write failure
needs review. Failures remain scoped to their family; another family’s successful
refresh cannot clear them. Failed list refreshes can retry without repeating
the mutation. Late list responses cannot replace
a more recent refresh. This preserves ADR 0039’s per-row busy rule.

Campaigns uses the shared `StatusBadge`: **Published**, **Suspended**, **Draft**
and **Deleted**, consistently with the editor. Published identifies a snapshot;
display rules still decide visibility. **Unpublish campaign** invokes unpublish
and returns the row to Draft; there is no invented paused state. Suspensions
show their server cause. **Unpublished changes** is neutral information, not a
warning that operation is blocked. Review changes opens the editor; **Publish
saved draft** remains in the menu with a primary confirmation. Destructive
confirmations remain red. A known missing design disables publication with a
visible instruction to add a design in the editor.
No Goal, schema, serving, capture, retention or delivery behavior changes.

## Genuine previews and comparable periods

`GET /optins/previews` is management-only and accepts 1–12 valid IDs. It returns
only ID, saved template and display type for requested non-deleted rows. It is
a separate bounded read: campaign summaries never carry full configurations.
Only visible designs are requested. Opening details lazily reads the selected
campaign, rule vocabulary and destination summaries through existing endpoints
for Audience & placement and After conversion, with explicit loading/retry.
The editor's shared summaries provide the wording, and the report period stays
visible beside detail statistics. The renderer is dynamically imported and
mounted inline inside an inert, scaled surface, without the loader, tracking
or submission callbacks. Responsive widths resolve against a stable preview
canvas. Missing designs show a neutral placeholder rather than an invented one.

Results show each Goal's `conversions` and `result_label`, never the resource
send headline. No cross-Goal rate or performance ranking is introduced. The
7/30-day read requests complete days and the footer says **Through yesterday**;
reports preserve that window and submission links use its server-resolved dates.
Independent result, preview and goal-name failures show a shared error with
Retry. A failed results refresh retains accepted values, dates and drill-down
links together; campaign management stays available. Older
responses cannot overwrite a newly selected period. A/B assignments are browser
storage records; appearances/conversions are not unique people.

## Header and visual grammar

The palette, type roles, radii, shadows and control sizes are shared tokens.
The original Campaigns-only 11–13px/27px scale and 10px corners were removed
following review: prototype fidelity was not a reusable reason to fork them.
The 56px desktop masthead is a shared layout decision, owned by `shell/header.css`.
Rows use `DataTable` with a grid layout and a labelled card layout below 900px;
gallery uses the same rows, values and actions in three, two or one columns.
Campaign identity is the card heading and actions are its footer; the status
and result fields retain visible labels. All table roles survive both layouts.
Layout-shaped loading reuses shared skeleton primitives and delay behavior.
Native radios provide status and view selection, keyboard movement and focus.
Control edges use `--input`; labels wrap; directional glyphs mirror in RTL.
The shared coarse-pointer floor is 44px, applied in the same cascade layer as
scope sizing so compact controls cannot override it.

Installed tier comes from `WpProPresence`, independently of license state.
Free offers the named paid tier through the shared tier vocabulary. Notifications reads known suspended campaigns and
configured destination issues on open; it is not an invented activity feed or
an unread count. Help links to existing settings and the product website. The
account link intentionally remains `#`, as the user requested, until a real
account destination is supplied. It does not impersonate WordPress login.

## Verification

Behavior coverage retains publication, suspension, deletion, A/B family and
winner, visibility-inspector and non-modal menu checks. It also checks real
result units, period scope, gallery/details, failed reports and duplicate guard
handoff. PHP tests check the bounded projection; all new reads retain management
permissions. Review includes actual WordPress desktop/mobile layouts and saved
rendered designs, alongside both Free and Pro builds and source contracts.

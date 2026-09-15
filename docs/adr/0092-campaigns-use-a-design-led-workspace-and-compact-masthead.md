# Campaigns use a design-led workspace and compact masthead

The approved Campaigns prototype becomes the production management page. The
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
duplicate, A/B and visibility tools follow. Pause/publish/winner actions are
separate from deletion. Destructive and publishing decisions are confirmed.
Duplicate copies the saved config through the validated creation route and
opens the resulting draft. A/B uses its existing endpoints and availability.
An in-flight write temporarily blocks other writes and navigation. The guard
is released before opening a created draft, so the editor owns its next state.

Campaigns labels a published, unsuspended snapshot **Live**, not proof that it
appears on every visit. Display rules still apply and the detail dialog says so.
Suspended rows say **Not showing**, with the server's cause. Pause invokes the
existing unpublish route; no paused state is added. Unpublished rows still say
Draft because storage cannot distinguish never-published and paused designs.
Saved/live differences say **Unpublished changes**. Review changes leads to the
editor; **Publish saved draft** remains available in the menu with confirmation.
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
A failed results read leaves campaign management available with Retry. Older
responses cannot overwrite a newly selected period. A/B assignments are browser
storage records; appearances/conversions are not unique people.

## Header and visual grammar

The palette remains the admin's existing petrol and semantic tokens. Campaign
furniture uses 11px metadata, 12px controls/notes, 13px campaign names and a 27px
page heading; this is an explicit compact reading-page extension to ADR 0037.
The surface uses a 10px corner radius. Rows reflow below 900px; gallery becomes
two and then one column. Explicit table roles preserve semantics under CSS grid.

Installed tier comes from `WpProPresence`, independently of license state.
Free offers Explore Pro. Notifications reads known suspended campaigns and
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

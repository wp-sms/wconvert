# Template discovery and reviewed collections

Accepted 2026-09-30. Implements picker A inside the existing plugin. No CI or
real email/SMS delivery is part of this local implementation.

## One preparation and editing path

Goal-first creation browses a metadata-only Playbook index. Cards are grouped by
canonical design identity **after** applying Goal, business, format, search,
source pack, availability and Saved filters. Recommended order and Name A–Z are available. Cards show matching use-case counts; inspection chooses among those use cases;
copy changes are not counted as different designs. Lists paginate at 24 cards.
The October 1 flow review makes inspection the sole creation-card action: Use
this setup belongs to the detail footer. **Amended by
[0132](0132-every-screen-answers-its-first-question.md):** past three setups, the
first recommended one the site can use is drawn on its own above the gallery
with a direct Use this setup (and Preview first); every other card still opens
inspection first. Comparison columns also carry Use this setup. The shared card separates identity and
Save, metadata, and the Preview/Compare action row. Source identifies included
content or an installed pack; Collection names an editorial discovery list.
Visible cards lazily request at most 24 actual Prefill compositions per request.

Collections, inspection and comparison share one dialog. Back restores the
collection stage, scroll and the chosen design's detail control; closing returns
to the library control. Native radio strips provide one-of-N screen, device, format and stage choices
with browser-owned arrow navigation. Phone inspections start at phone width.
Two selected designs can be inspected side by side before
continuing to one exact setup. Comparison creates no campaign. The optional
helper refines business and format, keeping the explicitly selected Goal.
**Corrected by [0132](0132-every-screen-answers-its-first-question.md):** the
helper no longer exists; business is a More filters select, and Use this setup
in a comparison column does create the draft.

Picker radio strips render as compact selection chips with a solid selected
state; their native inputs are visually clipped, and WordPress pseudo dots
are suppressed. Search, selects and toolbar buttons share the 32px fine-pointer
height (44px minimum for coarse pointers). One native Compare checkbox and one
selection tray are shared between creation and the editor. The tray names the
selection, allows clearing, and enables comparison only at two designs.
Comparison uses open columns with equally sized, fully fitted preview frames;
large journeys use a named Screen select instead of an overflowing chip row.

Setup inspection shows the shipping renderer at desktop/phone widths, every
screen and result, practical requirements ~~and the existing local journey
test~~. *Amended by [0137](0137-details-and-previews-read-at-a-glance.md): the journey test is out of setup inspection — it lives
in the editor — and the preview stays clickable.*
A source revision and a prepared snapshot revision accompany creation. Changes
to the source or site configuration after inspection return 409; the user can
reload and inspect again. Draft creation and publication remain the existing
Optin paths. A failed or unavailable preview has a recovery state in the preview
area. An uncertain creation response keeps Check Campaigns inside the modal
footer and prevents a second create click; a background notice is insufficient.
This introduces neither a second builder nor campaign scheduling.

Changing layout retains the existing Goal, content-transfer review, source
baseline, hard refusal rules and undoable draft application. Editor comparison
compares sample layouts in the same dialog, then opens the existing exact
content-transfer review; comparison itself applies nothing. Creation, pack
inspection and editor replacement share search anatomy, native device/screen
choices and a shipping-renderer preview frame. ~~Full inspection defaults to
width fitting so tall phone forms remain readable with vertical scrolling; the
shared Zoom control also offers Fit entire design.~~ *Amended by [0137](0137-details-and-previews-read-at-a-glance.md): full
inspection opens on the whole design on desktop and on the width on a phone,
where that reason holds; the shared control is an icon toggle naming what it
does ("Fit whole design" / "Actual width").* Comparison keeps equal-height
fully fitted frames. Screen labels use the
actual tree names, and result variants remain inspectable. Pack contents use
the existing lazy actual design cards, format/search filters and 24-card pages,
with explicit inspection before continuing to editor review. Canonical stars and
pagination are shared; collections, occasions and setup choices do not replace
campaign content through this flow. Show all designs remains available.

The editor library has a constrained flex chain: only the gallery body scrolls,
with selection and pagination outside that viewport. Pack pagination likewise
stays outside its scrolling design list. The September 30 modal refinement
replaces the interim whole-dialog scroll with shared `PickerDialogContent`,
`PickerDialogHeader`, `PickerDialogBody` and `PickerDialogFooter` components.
Collection, setup inspection, pack inspection and editor replacement scroll
content independently of their header and action footer. Existing focus and
collection scroll restoration use the body boundary. Ordinary cards retain
one size, including a sole result; no card has a use-case or screen dropdown.
Small use-case sets use native radio choices inside inspection, alongside
all-screen preview controls and progressively disclosed setup guidance.
These boundaries keep page controls and inspector actions reachable in short windows. See the [shared modal review](../reviews/picker-modal-unification-2026-09-30.md). See the [controls and scroll repair review](../reviews/picker-controls-repair-2026-09-30.md).

## Collections, dates and ownership

A Collection is a reviewed discovery list, separate from a delivery pack. It
references exact campaign setups and optional before/during/after stages.
Counts reflect available matching setups and distinct canonical designs.
Featuring applies filters, site-date windows, explicit market choices and user
preferences before ranking. Empty matches are omitted; an empty stage falls back
to a populated stage. Manual arrows/scrolling expose up to five featured entries,
with all relevant collections available separately. There is no auto-rotation. Arrows appear only for overflow and disable at the
ends. The user can hide the entire featured shelf while retaining Browse
collections, and restore it in preferences. Preferred business groups affect
collection order rather than removing other matching collections.

The server supplies the site day, timezone and clock reference. The browser
updates the site day as time passes, including while offline, without another
catalog request. Shared event ends are exclusive; site occasion ends are
inclusive. Collection expiry removes recommendations, not drafts or saved
campaigns. Open inspection does not jump away at midnight.

Saved design identities, hidden collections, event opt-outs, preferred businesses, shelf visibility and market
preferences are authenticated user meta, scoped to the current blog. Markets
are chosen by country name through the existing searchable country picker and
read-only country vocabulary endpoint; this never writes the phone default. A favorite
survives installed pack version changes through `pack:<pack-id>:<logical-id>`;
immutable template IDs still include the package digest for source baselines.
Removed designs remain named Saved entries that can be removed by the user.
Merchant-defined occasions use a non-autoloaded site option. Their names and
dates aid planning; no targeting, discount, campaign, or publication command is
stored. Writes use document revisions and bounded short-lived option leases;
a conflict requires reload. No table or column is introduced.
*Amended by [ADR 0153](0153-an-occasion-travels-as-one-document.md): Copy to
next year and Import write the occasions under the same lease without a
client revision, because the server read the document it changes. The option
also keeps the ids of deleted occasions (`retired`), which are never used
again (ADR 0149 §5).*
*Amended by [ADR 0149](0149-an-occasion-groups-campaigns.md): campaigns now
point at an occasion through `config.occasion`, and creating one inside it
prefills its schedule. The occasion still stores no targeting, discount or
publication command, and still schedules nothing by itself.*

## Internal review and the future API

The repository studio compiles collection candidates from source fingerprints,
prepared setup revisions and current shared review records. Every dependency
and collection must be approved with visual, journey and native WordPress
evidence. Changing source, renderer or supporting evidence makes review stale.
`templates:collections:check` rebuilds and refuses stale or changed shipped
snapshots, and the release build runs it before staging. Studio and authoring files remain under excluded `/tools`; customers
receive published JSON plus translated labels. Runtime bundled collections also
verify referenced source hashes. The studio reads public authored data, not
customer accounts, campaign records or Leads.

The configured optional catalog additionally accepts a schema 2 immutable
manifest and bounded, same-origin pages pinned by SHA-256. All pages and exact
pack references validate before replacing the local cache. Normal discovery
uses local installed/cached data; refresh remains explicit. Schema 1 catalogs
cannot inject collections. See the [protocol](../template-discovery-api.md).

The schema 2 local-directory publisher now builds from the same shared review
store, reconstructs source/renderer revisions and validates with the shipping
reader. It uses immutable content-addressed pack files, bounded pages, explicit
current-release comparison, an exclusive local lock and a manifest-last commit.
Changed bytes require a new pack version; unchanged objects are reused. The
old schema-1 builder remains a frozen compatibility fixture, not a second active
editorial publishing workflow.

Hosting, live paid-download entitlement and
historical archive cleanup remain separate integrations. `VerifiedAssets`
provides tested bounded PNG/JPEG/WebP staging and reuse, but schema-1 packs still
require empty assets. The host-neutral download service requires an injected
real licence decision before premium bytes can be read; no test authorizer is
registered in the plugin or exposed over HTTP. See the
[local publishing workflow](../../tools/design-library/publishing/README.md). The existing
128-file archive limit refuses further installs safely; no baseline is deleted.

### Hosted extension boundaries — 1 October 2026

The [implementation plan](../plans/template-picker-and-collections-2026-09-30.md#hosted-delivery-extension--implementation-status)
now specifies the following future boundaries. These do not describe shipped
media or licensing support and do not relax the current reader/pack validators.

- Keep source, collection membership, provenance and review history in the
  repository. R2 is the recommended JSON/media store. As of 12 October, an isolated
  Worker read service exists under `tools/template-server` and runs against
  locally simulated R2; no cloud bucket or Worker deployment exists. The
  service exposes public catalogue/Free files. As of 18 October, locally tested
  Nexus grant verification handles premium downloads; missing configuration still
  refuses them. Real credentials and live staging acceptance remain deferred. The licence
  manager remains authoritative, with no duplicate licence database.
- Give public Free and Pro previews equal quality on the website and in the
  plugin. Generate previews from the same approved revisions, with all-screen
  and device inspection. Protect premium importable packages and original media;
  do not claim rendered demos cannot be copied. Load online demos deliberately
  and preserve local inspection of installed content.
- Require an eligible valid licence for new premium downloads/updates. Expiry
  does not disable installed designs, local media or campaigns. Keep installed
  capability checks separate from server download authorization; no visitor-time
  licence dependency is added. Outages do not mean a licence is invalid.
- Stage, verify and install media locally as a complete required set. Preserve
  existing campaign references. Retain separate public/private access boundaries
  and asset provenance. The current empty-assets constraint stays until this
  versioned extension is implemented and tested.
- Publish complete release indexes and complete changed pack snapshots, reusing
  unchanged immutable objects. Do not duplicate all images per release or depend
  on patch chains. Current release-bound catalog pages are regenerated. Upload
  objects and validate them before atomically publishing the entry point; protect
  referenced versions during cleanup and rollback.

Local-directory publisher fixtures, importer development, fake licence responses,
preview generation and template review do not require cloud provisioning. Actual
authorization, private delivery and release/rollback acceptance require the real
licence API and staging infrastructure before public launch. No deployment, CI,
real delivery or merge is included.

## Initial publication and verification

Five collections initially referenced 16 freshly re-reviewed setups; the 1 October round-2 review expands this to 18. Black Friday is a
set of adaptable preparation ideas with a feature window beginning 16 October,
not a claim that a complete branded seasonal pack or conversion study exists.
At that review, 92 other pilot setup approvals remained stale. The 12 October refresh below supersedes these counts; the library is still not collectively approved.

See [implementation and validation](../reviews/template-picker-implementation-2026-09-30.md).
This amends ADRs 0082, 0083 and 0085. Existing Optin snapshots and metrics remain
independent of template updates and editorial collection membership.

The [plan audit](../reviews/picker-plan-audit-2026-09-30.md) distinguishes this
local delivery from the incomplete wider API, retention, simulator, merchant-study
and expansion programme. The prototype is a design reference, not proof that
every planned remote or release scenario has shipped.

The [shared-surface review](../reviews/picker-shared-surfaces-2026-09-30.md)
records the subsequent pack/editor alignment and guideline-based preference
regions, verified on `wconvert.local`. This supersedes the earlier audit’s
creation-only comparison limitation; it does not complete the wider API programme.

The [1 October flow audit](../reviews/picker-flow-audit-2026-10-01.md) records
inspection-first creation, consistent card actions, readable preview zoom,
country-name selection and visible failure recovery. Collection introductions
appear once in the header; stage and search controls share a row where space
allows. Single-format collections omit redundant format filters. One-page
results retain their page count without disabled navigation buttons.


The [local release verification](../reviews/template-local-release-2026-10-01.md)
records native WordPress acceptance of 13 setups / 10 designs in three Free packs
and two collections. This is a compatible subset, not another set of newly
created templates. Three reviewed bundled setups retain their artwork/links and
remain deferred for reviewed source-artwork conversion or the site-link extension. Layout replacement
now labels settings “My preferences” and omits shared occasion management;
creation retains that management surface.

## 2026-10-01 — local follow-through

Named WordPress timezones can suggest a country using the timezone database. Suggestions never choose a market automatically or identify visitors. The user confirms or dismisses; explicit markets take precedence. UTC/fixed offsets/unknown zones have no inferred country. Dismissal is personal and scoped to the suggested timezone.

Custom occasions now select an available stage in reviewed evergreen planning collections. The inclusive occasion end remains distinct from campaign scheduling. *Amended by [ADR 0149](0149-an-occasion-groups-campaigns.md): it is converted once, as a prefill, when a campaign is created inside the occasion — `ends_at` is the day after the inclusive end, 00:00.* HTTP sites use a shared getRandomValues-based authoring ID helper. The journey tester excludes genuinely hidden consent from submitted answers; it neither invents consent nor accepts unresolved references.

Raster pack installation is implemented in ADR 0082. The local publisher exports reviewed source raster bytes only with recorded redistribution rights. Public HTML previews contain inert rendered design screens, including result variants, and no importable template tree. Free and Pro use the same generation path and desktop/mobile/RTL controls. Catalog cards offer the same public preview URL for website and plugin use. Hosting and premium entitlement are still deferred; no default remote endpoint is introduced.


## 2026-10-01 — stable approvals and first illustrated release

Campaign approval identity includes prepared content, setup and renderer bytes,
excluding only derived nearest-neighbour results, similarity fingerprint and the
previous revision property. New neighbours no longer invalidate unchanged work.
Copy, structure, requirements, configuration, renderer or evidence changes still
do. Fifteen current approvals were renewed after exact old-algorithm, renderer,
content and evidence verification; 92 stale approvals remain stale.

Specification sheet and Excerpt window now have native WordPress campaign and
all-screen desktop/phone/RTL evidence. They join the launch and reader collections.
Homeware care retains its compact bundled SVG and adds an independently reviewed,
hash-bound raster export. All five curated collections have current approvals.
At that review the local downloadable subset was 16 setups / 13 designs / four Free packs /
two complete collections, with one original raster image. Existing campaigns are
unchanged. This supersedes the earlier 13/10/3 release counts, not the remaining
hosted licence/API/website deployment work.

See [round-2 practical review](../reviews/template-practical-round2-2026-10-01.md),
[approval identity evidence](../reviews/template-stable-approvals-2026-10-01.md)
and [artwork export](../reviews/homeware-artwork-export-2026-10-01.md).


## 2026-10-12 — resume after plugin changes

The studio now prepares 128 setups using 75 designs; the full source inventory contains 107 designs and 153 registered setups. Three new commerce compositions and three new setups join three existing setups in Help shoppers choose. Every screen/result was reviewed, and six examples ran in a disposable WooCommerce site. The studio now previews product-result areas and follows v3 graph entry/routes using the shipping traversal helper.

Six curated collections depend on 24 currently approved setup snapshots. The other 104 studio approvals remain stale, visible as such; refreshing compatibility does not rubber-stamp them. Changed upstream note references are renewed only after review. Runtime collection seeds are regenerated from exact approved revisions.

The local release contains 22 setups / 19 designs / five packs (four Free, one premium) / three complete collections, plus the existing reviewed raster artwork. Changed pack bytes receive new versions. Premium source JSON stays private and its public preview is inert, using the same preview path as Free. Native installation/offline/update checks are rehearsals; no hosted service, default endpoint, licence connection, CI or external delivery is enabled. See the October commerce review and release evidence in `docs/reviews`.

### Local staging preparation — 12 October 2026

As of 18 October the Worker has separate public/private bindings and a Nexus-signed grant adapter, tested locally. No permissive licence adapter is shipped. The local seed CLI reads validated public release output, verifies dependencies, reuses immutable objects and conditionally promotes the manifest after read-back. Workerd/R2 runtime checks cover failure preservation, competing publishers and rollback. This is a loopback HTTP mirror of HTTPS metadata, not a configured plugin endpoint. The authenticated R2 publisher and live Worker were verified on 18 October: Free/public HTTPS delivery and disposable WordPress installation/offline acceptance passed. Rate limits/backup operations, plugin default endpoint enablement and live premium entitlement acceptance remain outstanding. See [staging operations](../../tools/template-server/README.md).

### Nexus grants — 18 October 2026

Nexus v2.7.0 is the entitlement authority. The local Worker verifies its signed
short-lived grants and stores expected subject/resource context in private R2;
all private reads reverify the signature, exact file membership and hard expiry.
The configured grant and public-key endpoints share an HTTPS API origin, which
may differ from the exact signed issuer. The 19 October connection uses
`my.wconvert.io` for both endpoints and pins `https://nexus.veronalabs.com` as
issuer independently; redirects remain forbidden. The signed environment is
`production`, regardless of the plugin’s prelaunch status.
One-day lifecycle cleanup removes expired contexts. No customer key is stored.
The plugin's SDK-backed adapter lives under `pro/src/License/` and is invoked only
by explicit premium pack downloads. It pins the trusted HTTPS API origin apart
from the editable catalogue setting. The build still gates installed features.
See [the protocol and deployment checklist](../../tools/template-server/README.md).
R2 publication and the live HTTPS Worker/Free WordPress path are now verified. On 19 October the operator deployed the Nexus connection; live invalid-licence issuance and anonymous premium refusal checks passed. Successful licensed acceptance, launch operations and default plugin endpoint enablement remain outstanding. See [connection evidence](../reviews/nexus-worker-connection-2026-10-19.md). See [hosted verification](../reviews/template-cloud-publishing-2026-10-18.md).

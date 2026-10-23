# 0156: The catalogue is one design per object

Date: 2026-10-20. Status: accepted.

Supersedes the pack format of [0082](0082-template-packs-install-as-validated-local-data.md)
and the discovery schema of [0112](0112-template-discovery-and-reviewed-collections.md).
Amends [0010](0010-templates-are-configuration-not-documents.md),
[0015](0015-enforcement-is-by-non-registration.md),
[0043](0043-the-library-is-indexed-and-its-facets-are-derived.md),
[0083](0083-installed-packs-supply-campaign-starting-points.md),
[0127](0127-free-keeps-product-seams-not-product-reads.md),
[0132](0132-every-screen-answers-its-first-question.md),
[0116](0116-free-shows-nothing-it-cannot-run.md) §1 and
[0147](0147-free-names-what-pro-adds-where-it-is-wanted.md) rule 3. The wire
contract is [docs/template-discovery-api.md](../template-discovery-api.md).
Amended by [0157](0157-free-designs-may-be-served-without-being-bundled.md) (§5).

## Context

The library will pass 500 designs across five formats, split Free and Pro, and
is served from `templates.wconvert.io` to both the plugin and the website.
After free-v1 ships on wp.org every installed reader is frozen, so anything a
v1 reader must understand has to exist before then. A review of the v2
format found the walls in code: a 256 KiB website index (about 85 designs),
128 archive files and 128 image sets per site, 50 packs of 12, a reader that
refused a whole pack for one unknown key, every rebuild demanding the newest
plugin, no metadata to search by, every archived pack re-validated on every
admin request, premium JSON readable from `uploads/` by its public digest, and
no way to withdraw a design.

## Decisions

**1. The unit is one design.** A design and a setup are each an immutable,
content-addressed object (`v3/designs/<sha>.json`, `v3/setups/<sha>.json`).
A pack is gone; a Collection is a named list of design and setup ids. Free or
Pro is set per design, and a setup's plan is the highest of its design, Goal,
format and rules. A setup pins one design revision, and installing it brings
that design and its images.

**2. The major version is in the address.** The pointer is
`/v3/manifest.json`, the only mutable object: the current release, the
`withdrawn` list, an optional popularity sidecar, and `latest_major` so a v3
reader can say "Update WConvert to see new designs" while v4 sits at `/v4/`.
A higher `minor` is read.

**3. Tolerant outside, strict inside.** The pointer, release, index entries,
design and setup envelopes and `meta` drop keys they do not know. The tree,
tokens, images, bindings and a setup's playbook stay strict: that is 0082's
security boundary, now `DesignObject` wrapped around the unchanged
`PackValidator`. *Amended by [0162](0162-the-delivery-plan-is-derived.md):*
`image_bindings` rows are `{slot, asset_id}` (minor 1), so a background picture
downloads like an image. An unknown plan, format, capability or newer `requires.plugin`
means "update the plugin", never "free". A failure costs one design.

**4. Requirements are computed.** Every manifest node, param, content key,
role, choice, token and field has a `since` stamp in
`resources/templates/since.json`; a test fails on a missing one. The exporter
declares exactly the capabilities a design uses and the newest stamp as
`requires.plugin`, so a rebuild no longer demands the newest plugin.

**5. Identity.** Ids are never reused; a renamed design keeps the old id in
`aliases`. Revisions are integers from `tools/design-library/publishing/revisions.json`,
a content-hash registry that also writes each ZIP's
`resources/templates/revisions.json`; the release build refuses a stale one.
*Amended by [0157](0157-free-designs-may-be-served-without-being-bundled.md):*
a third source, `tools/design-library/hosted/templates/`, holds Free designs
the catalogue alone serves, and `tools/design-library/hosted/playbooks/` their
setups. They are numbered in the registry like any other and listed in neither
ZIP's file, because neither ZIP carries them.
Across bundled, installed and hosted copies **the highest revision wins**,
replacing first-source-wins. Undo a bad design with a newer revision; pointer
rollback is for a broken index.

**6. Availability per hosted design**, strongest first: `unavailable` (another
plugin missing) › `locked` (Pro) › `update_plugin` › `install` › `ready`.

**7. Local storage.** Installed objects live in `uploads/wconvert-templates/`
named by `HMAC(digest, wp_salt('auth'))`, so the public digest no longer
locates premium JSON; a rotated secret renames on read. No file count is
capped. Index pages are files and only a pointer lives in the option. The
validated library is cached in a file keyed on the archive and image listings,
the installed plan, journey and commerce support, the plugin version and the
vocabulary, so deactivating Pro is a fresh validation. Cleanup keeps every
revision any row's `config` or `published_config` names (drafts, trashed, A/B
variants) and every setup pin; images are never deleted. No table or column.
*Amended by [0161](0161-used-template-artwork-belongs-in-media-library.md):*
preview/install keep using this verified cache; creating or saving a campaign
copies the artwork actually used into Media Library, reuses existing copies,
and saves attachment URLs in that draft.

**8. Fetching.** The library is on by default and asks first: a one-time card
in the picker, kept as an option and a Settings toggle, plus the
`WCONVERT_TEMPLATE_CATALOG` constant and `wconvert_template_catalog` filter to
switch it off. A refresh happens only inside an admin request that asked —
opening the picker asks at most every twelve hours — never on activation,
from cron, on the dashboard or on the front end. It uses `If-None-Match` on
the pointer, skips pages when the release is unchanged, has a twenty-second
budget and a backoff, and names `WP_HTTP_BLOCK_EXTERNAL` when that is why it
failed. A reader that outgrows its 1 MiB index budget keeps the pages that fit
(oldest first) and says to update.

**9. Free meets a Pro design only as a locked image card**, inside the picker,
for someone who could install Pro (`ProHints::shown()`): a server thumbnail
loaded with `referrerpolicy="no-referrer"`, the plan's name and a link to the
design's page on wconvert.io. No Apply, no disabled control, no Pro JSON, no
"upgrade". Free sorts what it can use first. This **supersedes 0116 §1 and
0147 rule 3 for designs only**. **Amended 22 October 2026:** hosted collection
browsing also shows every published member, before installation and across
Goals, with Free/Pro labels. The existing `ProHints::shown()` gate still applies
to paid discovery: opted-out or restricted Free users see only Free or already
usable members, with matching counts. Pro users retain all members. A seasonal collection may contain mostly Pro
designs. **Clarified 23 October 2026:** the approved Christmas/New Year batch
is 30 Pro / 10 hosted Free. Publication has no global Free-majority quota;
the old publisher check incorrectly imposed one on downloadable objects.
Availability is enforced per design, not by changing approved tiers to meet
a catalogue-wide ratio. Locked members remain public image cards and external links; they
never receive Pro trees or an install/use control. Creation itself still
requires a usable Goal and setup. Install adds the exact hosted setup; Use
explicitly creates a draft for that member's Goal. A bundled usable copy can
be used immediately without downloading it again. Other creation surfaces
continue to hide what Free cannot run. See [0157](0157-free-designs-may-be-served-without-being-bundled.md)
for catalogue-only collections. This remains a case-by-case reading of
wp.org Guidelines 5 and 11.

**10. Withdrawal.** A withdrawn design leaves the picker and cannot be
installed; an Optin already using one keeps its copy and its details say so.
Nothing is deleted from a site remotely. A release may not drop a live design
without withdrawing it.

**11. Pro asks for one pass per install**: `POST /v3/grants` with up to fifty
design and setup digests; the Worker covers each object and its images.

**12. Counting** is an Analytics Engine data point per design-object download
from the plugin's user agent, written before any lookup, with no identifier.
A script turns it into the popularity sidecar.

**13. Authored catalogue words** — description, slug, industries, occasions,
style, colour, family, aliases — live in `publishing/designs.json`, beside
0043's derived facets, which the publisher also writes into each entry so a
card with no tree can still be filtered by Goal. Taxonomy labels live in the
release, not the plugin. Every image needs a rights record of a known kind
(original, AI-generated or licensed), bundled designs included. Literal colours
in node tokens can only go down (`publishing/colour-baseline.json`), so a
later Brand setting can restyle designs through their tokens.

**14. A "Use this template" link** is `admin.php?page=wconvert&design=<id>`,
a query string because the login screen keeps one. It opens Goal-first
creation with the design pinned and only the Goals it can serve; asks for
consent where the design is not cached; says "no longer available" with close
alternatives for an unknown id. Nothing installs on page load.

**15. Automated checks, never a new human gate.** Approval stays agent review;
these only refuse what is objectively wrong or make review cheaper:

- **Approval follows rendered output**, not renderer bytes
  (`build/rendered-identity.mjs`). `templates:visual-diff` renders each
  campaign whose renderer moved with both renderers at two widths and carries
  only the pixel-identical ones forward by a record that says so.
  *Amended 20 October:* the key covers only what ships — the rendered screens
  and the shipped configuration — not the planning brief or batch; an edited
  evidence file no longer stales a decision (a missing one does); collections
  are keyed on setup revisions, not record ids. `visual-diff` also writes the
  changed screens before beside after, so a re-review judges the change.
  *Amended by [0162](0162-the-delivery-plan-is-derived.md):* the key still
  hashes the whole stylesheet, so a CSS edit that draws nothing differently
  stales every approval. `templates:releasable` fails the pull request until
  `templates:visual-diff -- --apply` has carried them.
- **Two of the three checks are run by a machine.** `setup-checks.mjs` walks
  every setup to review as a visitor on a disposable WordPress and writes
  `results.json` (`journey`, `wordpress`); the reviewer judges contact sheets
  (`batch-audit.mjs --capture`) against a short list in
  `pilot/PRACTICAL-REVIEW.md`. The unused screenshot-ledger check is removed.
- **Review records are one file each**, chained by `base_id`; a fork from two
  branches is refused on read instead of the later merge silently winning.
- **Near-duplicates** — structure, palette and a thumbnail difference hash all
  agreeing — are refused unless `publishing/near-duplicates.json` gives a reason.
- **Contrast** is measured against the pixels behind each text, pictures
  included (WCAG AA), and a **copy lint** refuses placeholders, doubled words,
  stray spacing and unbalanced brackets.
- Per-design browser work is **cached** by the design, renderer and step code,
  so a publish renders only what changed.

## Consequences

- `InstalledPacks`, `DiscoveryRelease`, `LockedTemplates`, `locked.json`, the
  schema-1 builder and the pack UI are removed. Existing dev installs lose
  installed packs; there is no migration (pre-release).
- Thirteen planned setups whose designs carry an unconverted SVG, an image
  with no rights record or an out-of-vocabulary setting are `bundled_only`:
  shown on the website from the bundled source, not downloadable, until the
  reason is fixed.
  *Amended by [0162](0162-the-delivery-plan-is-derived.md):* there is no
  plan list of setups, bundled-only setups or Collections any more. Each is
  derived from current approvals and the exporter's result, and a held setup
  carries the exporter's own reason.
- The v2 public routes stayed readable until the website read v3 detail pages
  (wconvert-website PR 4, 20 October); since then every v2 route is gone.
- Accepted residual risk, recorded by the owner: approval stays agent review;
  quality and AI image rights rest on that review, and production publish
  keys live on the dev machine. Only automated checks were added.

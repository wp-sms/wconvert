# Template packs install as validated local data

The design picker could compose sources but had no download, import policy or
persistent archive. ADR 0043's normalizer was not a complete remote boundary:
known token names still accepted arbitrary scalar values and unknown structure
was silently dropped.

> **Superseded in format by [ADR 0156](0156-the-catalogue-is-one-design-per-object.md).** Packs are gone: each design and setup is its own content-addressed object, read through a tolerant envelope around the strict validator this ADR introduced, which is unchanged. The limits below (50 packs, 12 designs, 128 archive files and image sets) no longer exist; archive files are named by a keyed hash, not the public digest.

## The first complete slice

**Your designs / Template packs** share the existing picker. **Amended by
[ADR 0127](0127-free-keeps-product-seams-not-product-reads.md):** the Template
packs tab appears only once a catalog service is configured. **Amended 19 October by [ADR 0112](0112-template-discovery-and-reviewed-collections.md):** the hosted service is the default configuration, with explicit empty/custom overrides retained. Opening it reads
local state only. Checking the catalog, previewing a new pack and installing are
explicit, authenticated administrator requests. The notice explains which
service is contacted. Installing changes the library; the existing content-choice
preview and Use this design action change the working draft. No action publishes.

The [pack experience](../reviews/template-pack-experience-2026-09-14.md) groups
installed and available collections, keeps updates explicit, and presents a
selected design at desktop/mobile widths. Continue with this design opens the
existing content-choice review; it does not apply the design.

> **Amended by [ADR 0106](0106-question-journeys-extend-the-paid-loader.md):** The pack boundary also accepts bounded Pro question journeys on a paid install when `question-journey:1` is declared. Product IDs and links remain site-local and must be chosen after installation. Free installs still refuse paid designs.

Version 1 installs Free popup/inline designs with placeholders. The initial local
sample reused Reading slip, Callback notes and A useful little guide. The
[first curated collections](../reviews/curated-template-collections-2026-09-14.md)
now package ten existing reviewed designs into three collections. Source JSON
fingerprints pin the review; the build validates packages and preserves existing
release files. Old installed samples remain usable. Goal-first creation and
Playbook copy/rules remain bundled. Downloaded Playbooks now join the existing creation flow under
[ADR 0083](0083-installed-packs-supply-campaign-starting-points.md). Paid fetch
entitlement remains a subsequent slice. Schema-2 verified raster installation is implemented by the 2026-10-01 amendment below; unsupported packs explain their limitation.

## Download and validation

An operator configures `wconvert_template_catalog_url` as a WordPress option.
There is no default production endpoint or background contact. The optional
service's packs remain JSON schema 1. **Amended by [ADR 0112](0112-template-discovery-and-reviewed-collections.md):** the index also accepts schema 2 immutable discovery manifests with bounded digest-pinned pages and reviewed collections. Normal browsing still reads local data; refresh remains explicit. Each pack declares its version,
minimum plugin version, tree version and capabilities. Required capabilities are
derived from the actual nodes and must be declared. `requires.tree` is mandatory
for the pack; individual bundled-style trees may omit `v`, in which case this
explicit pack version supplies it. A supplied `v` cannot exceed the declared pack version; mixed v2/v3 packs declare tree 3 and each used tree capability. A missing `v` inherits the declared version. Every normalized preview/installed tree preserves its validated version. Layouts carry
no IDs; leaf IDs must be unique. An index pins its exact
bytes with SHA-256; install rechecks the digest the merchant previewed.

WordPress safe HTTP handles requests, with a 15-second timeout, 256 KiB response
cap, no redirects and HTTPS. *(Amended by [ADR 0156](0156-the-catalogue-is-one-design-per-object.md): per object; the index is up to 16 pages and 1 MiB.)* The index accepts at most 50 packs (raised from
20 for library expansion on 2026-09-28); the per-pack limit remains 12 designs.
The build and reader share one bound. A 51-pack response is refused without
replacing the cached index. This supplies bounded capacity for 600 design slots,
not an assertion that 600 designs have been authored or reviewed. The only HTTP exception is the current site's host
in WordPress's `local` environment. Pack URLs must share the configured origin.
For anonymous public discovery and Free downloads, no licence, lead, campaign, cookie or site identifier is deliberately transmitted;
the service necessarily receives the server IP and requested URL. The user agent
is a fixed catalog label, without the WordPress default site URL.
**Amended by [ADR 0112](0112-template-discovery-and-reviewed-collections.md), 18 October 2026:** explicit Pro premium downloads send the SDK licence key and canonical site to a separately pinned HTTPS Worker origin. Nexus grants access; neither credential reaches public catalogue requests or browser responses.

Before any rendering or registration, reject unsupported schema/capabilities,
unknown node keys/types/roles/tokens, invalid value types, duplicate block IDs,
invalid conversion shape, media URLs/data URIs, markup and unsafe style syntax.
**Separated by [ADR 0113](0113-template-files-replace-only-reviewed-draft-designs.md):**
merchant ZIP files use an explicit portable policy in the shared validator;
merchant links and visible consent are accepted only there. The following catalog
rules are unchanged.

Schema 1 requires an empty assets list and empty picture/action URLs. Schema 2 permits the bounded raster manifest and inert bindings described below; authored tree URLs remain empty.
Style functions are restricted to colour, gradient and sizing expressions.
Limits: 12 designs/pack, 200 nodes/design, depth 12, 2 screens, bounded text and
styles, and the existing compressed per-design budget. This stricter import
policy does not restrict merchant-authored editor values.

*Amended for progressive capture by
[ADR 0103](0103-progressive-capture-keeps-one-lead-per-journey.md): replace the
two-screen limit with explicit linear-journey validation in JSON v2.
Update capability requirements and raw-structure validation together;
unsupported flow data must not be silently normalized into a different capture.
Existing packs are not promised a compatibility reader during this pre-release
redesign.*

## Local versions and failures

Validated pack bytes are atomically renamed from a temporary file into
`uploads/wconvert-template-packs/<sha256>.json`. Data is decoded, never included
or evaluated. The archive is capped at 128 files and is not autoloaded. *Amended by [ADR 0156](0156-the-catalogue-is-one-design-per-object.md): no cap; files live under `uploads/wconvert-templates/` named by `HMAC(digest, site secret)`, and a validated cache file replaces per-request re-validation.* No table
or column is introduced. The catalog index uses a non-autoloaded WordPress option;
a failed refresh retains the previous index.

Template IDs contain a content digest and source ID. **Amended by [ADR 0112](0112-template-discovery-and-reviewed-collections.md):** a separate canonical design key stays stable across pack versions for grouping and blog-scoped personal favorites; it does not replace immutable baseline IDs. New installs use the
highest installed version; earlier versions stay resolvable for content transfer
and source-baseline comparisons, but are omitted from the picker index. Updating
a pack never walks or rewrites Optins. Same bytes are idempotent; normal attempts
to replace the same release or downgrade are rejected. Concurrent different
release installs cannot overwrite one another's files or baselines.

Refresh, preview and install failures stay inside the pack view. Previously
installed packs can be previewed and used without the service, even if the index
changes or disappears. Corrupt local files are skipped so the bundled library
remains usable. A release requiring unsupported capabilities is rejected before
it can alter the local library. **Amended by [ADR 0112](0112-template-discovery-and-reviewed-collections.md):** paid pack fetching now uses the locally tested Nexus signed-grant adapter; real service configuration remains pending. No licence expiry check is added to installed functionality.


Deleting WConvert also removes both catalog options and its owned flat archive
files. Deactivation keeps them. Cleanup never follows a directory symlink or
removes unrelated uploads; the recovery regression runs against disposable files
and fake WordPress/database functions.

## 2026-10-01 — verified raster pack installation

Schema 2 adds `pack-images:1`, a hash/size/MIME/dimension/access manifest and separate `{template_id,node_id,asset_id}` bindings. Only normalized image leaves can bind. Free designs cannot reference premium assets. No remote/data URL is accepted in a downloadable tree. The client derives Free image paths from its configured catalog origin, stages and verifies the complete set, and commits the marker before registering the immutable pack. Runtime hydration uses verified local URLs; the archived JSON and digest are unchanged. Missing/corrupt images fail closed and can be repaired by explicit preview. Old media URLs are retained for existing campaigns; there is no automatic garbage collection. **Amended by [ADR 0112](0112-template-discovery-and-reviewed-collections.md):** premium images now use the same verified download pass and exact pack membership; missing service configuration fails closed.

The image budget is 16 files, 5 MiB per file and 20 MiB per pack, PNG/JPEG/WebP only, up to 4096px per dimension. Installed set markers are bounded to 128; this is not an unlimited cache. *Amended by [ADR 0156](0156-the-catalogue-is-one-design-per-object.md): the bound is removed; images are still never deleted.* Native verification uses `bin/verify-template-media.php` and the actual-release verifier `bin/verify-template-release.php`. The latter exercises the Homeware care pack, exact preview/install agreement, offline reads, a synthetic next-version update with image reuse, and retention of the original design/image references. Bundled SVG stays compact; the internal publisher accepts only an explicitly reviewed raster derivative bound to the source URI, raster and evidence hashes. Conversion is never implicit during a build.


## 2026-10-12 — current flow and commerce pack compatibility

The reader accepts explicitly declared `template-tree:3` *(renamed `template-flow:1`, declared beside `template-tree:2`, by [ADR 0156](0156-the-catalogue-is-one-design-per-object.md))* with graph structure, reference validation and the shipping GraphCaptureContract. The remote screen budget remains seven (portable merchant files retain their separate 256-screen v3 allowance); node/depth/byte limits are unchanged. Installed v3 designs use that graph contract during library registration instead of being silently rejected as linear journeys. A regression installs, updates and reopens an archive offline, preserving original route/style baselines. Malformed routes, unknown graph keys and authored URLs still fail.

`paid-campaign-rules:1` permits supported rule shapes at the receiving install's actual tier. Rule definitions still come from the manifest, unknown parameters are rejected and authored page/product/element identifiers remain forbidden. Thus an Elite basket condition can survive pack import without being weakened to “everyone”; Free/Basic cannot import that condition. Export access classification includes rule tiers as well as design/Goal tiers. This is client compatibility, not a replacement for hosted licence authorization.

The internal exporter supplies narrow filesystem adapters for its temporary validation archive, so the actual illustrated pack reader runs without WordPress. Native WordPress verification remains separate. `WCONVERT_VERIFY_PREMIUM_FIXTURES=1` explicitly allows the local verifier to read a private rehearsal pack; it creates no network entitlement path. **Amended on 18 October by [ADR 0112](0112-template-discovery-and-reviewed-collections.md) and [ADR 0143](0143-license-page-and-updater.md):** Pro now uses the SDK key for explicit premium pack/media requests through the Nexus signed-grant adapter. Updated 19 October: hosted Nexus authorization and a protected image install are verified; unconfigured service routes still refuse access. Installed functionality remains independent of entitlement.

# Template packs install as validated local data

The design picker could compose sources but had no download, import policy or
persistent archive. ADR 0043's normalizer was not a complete remote boundary:
known token names still accepted arbitrary scalar values and unknown structure
was silently dropped.

## The first complete slice

**Your designs / Template packs** share the existing picker. Opening it reads
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
entitlement and media installation remain subsequent slices; unsupported packs explain their limitation.

## Download and validation

An operator configures `wconvert_template_catalog_url` as a WordPress option.
There is no default production endpoint or background contact. The optional
service's packs remain JSON schema 1. **Amended by [ADR 0112](0112-template-discovery-and-reviewed-collections.md):** the index also accepts schema 2 immutable discovery manifests with bounded digest-pinned pages and reviewed collections. Normal browsing still reads local data; refresh remains explicit. Each pack declares its version,
minimum plugin version, tree version and capabilities. Required capabilities are
derived from the actual nodes and must be declared. `requires.tree` is mandatory
for the pack; individual bundled-style trees may omit `v`, in which case this
explicit pack version supplies it. Any supplied `v` must agree, and every
normalized preview/installed library tree carries the current `v`. Layouts carry
no IDs; leaf IDs must be unique. An index pins its exact
bytes with SHA-256; install rechecks the digest the merchant previewed.

WordPress safe HTTP handles requests, with a 15-second timeout, 256 KiB response
cap, no redirects and HTTPS. The index accepts at most 50 packs (raised from
20 for library expansion on 2026-09-28); the per-pack limit remains 12 designs.
The build and reader share one bound. A 51-pack response is refused without
replacing the cached index. This supplies bounded capacity for 600 design slots,
not an assertion that 600 designs have been authored or reviewed. The only HTTP exception is the current site's host
in WordPress's `local` environment. Pack URLs must share the configured origin.
No licence, lead, campaign, cookie or site identifier is deliberately transmitted;
the service necessarily receives the server IP and requested URL. The user agent
is a fixed catalog label, without the WordPress default site URL.

Before any rendering or registration, reject unsupported schema/capabilities,
unknown node keys/types/roles/tokens, invalid value types, duplicate block IDs,
invalid conversion shape, media URLs/data URIs, markup and unsafe style syntax.
The first format requires an empty assets list and empty picture/action URLs.
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
or evaluated. The archive is capped at 128 files and is not autoloaded. No table
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
it can alter the local library. Paid pack fetching is not implemented, and no
licence expiry check is added to installed functionality.


Deleting WConvert also removes both catalog options and its owned flat archive
files. Deactivation keeps them. Cleanup never follows a directory symlink or
removes unrelated uploads; the recovery regression runs against disposable files
and fake WordPress/database functions.

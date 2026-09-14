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

Version 1 installs Free popup/inline designs with placeholders. The initial local
sample reused Reading slip, Callback notes and A useful little guide. The
[first curated collections](../reviews/curated-template-collections-2026-09-14.md)
now package ten existing reviewed designs into three collections. Source JSON
fingerprints pin the review; the build validates packages and preserves existing
release files. Old installed samples remain usable. Goal-first creation and
Playbook copy/rules remain bundled. Downloaded Playbooks, paid fetch entitlement and media installation are
subsequent slices; unsupported packs explain their limitation.

## Download and validation

An operator configures `wconvert_template_catalog_url` as a WordPress option.
There is no default production endpoint or background contact. The optional
service's index and packs are JSON schema 1. Each pack declares its version,
minimum plugin version, tree version and capabilities. Required capabilities are
derived from the actual nodes and must be declared. `requires.tree` is mandatory
for the pack; individual bundled-style trees may omit `v`, in which case this
explicit pack version supplies it. Any supplied `v` must agree, and every
normalized preview/installed library tree carries the current `v`. Layouts carry
no IDs; leaf IDs must be unique. An index pins its exact
bytes with SHA-256; install rechecks the digest the merchant previewed.

WordPress safe HTTP handles requests, with a 15-second timeout, 256 KiB response
cap, no redirects and HTTPS. The only HTTP exception is the current site's host
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

## Local versions and failures

Validated pack bytes are atomically renamed from a temporary file into
`uploads/wconvert-template-packs/<sha256>.json`. Data is decoded, never included
or evaluated. The archive is capped at 128 files and is not autoloaded. No table
or column is introduced. The catalog index uses a non-autoloaded WordPress option;
a failed refresh retains the previous index.

Template IDs contain a content digest and source ID. New installs use the
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

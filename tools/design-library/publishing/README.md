# Local release publishing

This is the internal team's file-based publishing tool, not a customer screen
or a deployed API. No R2, Worker, licence credentials or network requests are
needed to build and verify a release.

## Build the initial release

From the plugin repository:

```sh
npm run templates:release:local -- \
  --directory /tmp/wconvert-template-release-local \
  --origin https://templates.example \
  --expected none
```

`templates.example` is only the future URL written into metadata; the command
never contacts it. Use a persistent, backed-up directory outside the WordPress
public document root for retained work. `/tmp` is appropriate only for disposable
rehearsals. The command refuses storage inside this site's public document root.
Do not serve the whole directory with a static web server.

The command rebuilds current renderer/setup revisions, checks the existing shared
reviews and source hashes, exports exact repository sources, and runs the shipping
PHP catalog/pack reader before publishing. It does not strip artwork or links,
auto-approve a review, touch campaigns, or configure the site's catalog URL.

`catalog.json` is the delivery plan: stable pack names, independent versions,
setup membership and selected editorial collections. Each collection member must
exist in the release. An existing pack ID/version cannot acquire different bytes
or change access scope; bump that pack's version when changing its contents.

The initial compatible release has **13 setups, 10 designs, 3 Free packs and 2
collections**. Three already-reviewed setups are explicitly deferred: the sale
bar contains a site-specific link; lighting and care notes contain embedded SVG.
They remain in the bundled library. Do not blank them to force catalog acceptance.
The existing media-free pack format still refuses those values.

## Files and updates

```text
storage/
  public/
    manifest.json                       # the only mutable entry point
    packs/<sha256>.json                  # Free pack snapshots
    releases/<release>/page-1.json       # complete catalog references
    releases/<release>/manifest.json     # retained immutable entry point
  private/
    packs/<sha256>.json                  # premium snapshots, when included
```

Only `public/` is a potential static hosting root. Premium catalog addresses use
`/downloads/<digest>.json`; a future API must authorize those requests and read
private storage. Those paths do not function until that API is connected.

For the next release, pass the current manifest's `release` value to `--expected`.
That explicit comparison plus the local exclusive lock prevents accidental
concurrent overwrite. New immutable objects are written and read back first;
`manifest.json` changes last. Retrying identical content reuses the existing
objects. Metadata-only changes reuse all packs. The same origin and same inputs
produce the same release ID. Different metadata pages are small complete files,
not patch chains. No files are automatically pruned.

A failed publication leaves the prior entry point in place. New but unreferenced
objects can be reused on retry. A leftover `.publish.lock` after process death
requires checking that no publisher is running before manually removing that
lock; it is never silently stolen. Cloud adapters will need storage-specific
conditional writes, not this local filesystem lock. Power-loss durability,
backup restoration and distributed promotion are separate staging checks.

## Verify against native WordPress

```sh
WCONVERT_WP_BOOTSTRAP=/path/to/wp-load.php \
WCONVERT_RELEASE_DIRECTORY=/tmp/wconvert-template-release-local \
php bin/verify-template-release.php
```

Use Local's MySQL socket setting for the CLI when needed. This verifier boots the
actual plugin but uses in-memory catalog options, a local file transport and a
temporary installed archive. It validates public packs, installation, exact
preview agreement and offline reads. It never updates site options, creates
campaigns or sends messages. It deliberately refuses private download fixtures;
real premium authorization needs a separate hosted rehearsal.

## Media and licence foundations

`VerifiedAssets` supplies a separately tested image installer. Its descriptor is:

```json
{"id":"hero","sha256":"<64 lowercase hex>","mime":"image/png","bytes":1234,"width":800,"height":600,"access":"free"}
```

It accepts PNG, JPEG and WebP only, at most 16 files/20 MiB per set, 5 MiB per
file and 4096px per axis. It verifies actual type, bytes, hash and dimensions;
stages all downloads before promoting them; writes the set marker last; reuses
verified files within the same access scope; and repairs corrupt cached bytes.
Stable local files survive later updates. It owns only its dedicated directory,
not merchant uploads. It does not add Media Library attachment rows or a DB table.
The download callback must itself bound the response while reading it.

**This installer is not yet connected to pack downloads or previews.** Pack schema
1 still requires `assets: []`. A reviewed pack-format extension must bind image
references, include rights/provenance checks, and commit the pack only after media
installation succeeds. SVG needs safe conversion or a deliberately reviewed
sanitizer. Existing installed copies and campaign image URLs must remain available;
reference-aware cleanup is still pending.

`build/download-service.mjs` is a host-neutral authorization boundary, exercised
with test-only licence responses. An internal resource map selects the object;
clients cannot supply storage paths or claim their own tier. Premium access needs
an allowed decision bound to the exact file, product and site. Expired/revoked,
wrong-plan/site and unavailable cases are distinguished. Premium responses are
`private, no-store`; all bytes must match the requested digest. No licence key is
put in a URL or response. No fake authorizer or permissive default is deployed.

The real host must supply the licence-manager adapter, bounded storage reads,
request authentication, rate limiting and cache-safe HTTP handling. Whether that
host is the existing backend or a Worker remains open. The website's public
Free/Pro previews, plugin online-preview integration, media-format wiring and
actual licence/site/staging/multisite behaviour are **not implemented by this
local publisher**. Installed Pro presence remains a capability check, not server
proof of a paid licence.

The real licence-manager integration was explicitly deferred by the user on
1 October. Keep its production adapter unconfigured until that work resumes.

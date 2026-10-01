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

The current compatible release has **16 setups, 13 designs, 4 Free packs and 2
collections**. Stores and publishers are version 1.1.0; services remains 1.0.0.
The new Homeware care pack (1.0.0) includes one original 1920 × 500 illustration.
The sale bar's site-specific link and lighting's unconverted SVG remain explicitly
deferred. They stay in the bundled library; incomplete collections are not exported.

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

Schema 2 connects verified assets to preview and installation through explicit
image-node bindings. Schema 1 remains image-free. The complete verified image set
must exist before a pack is installed. SVG is not accepted by the download reader;
use the explicitly reviewed derivative workflow below. Existing campaign image
URLs remain available; reference-aware cleanup is still pending.

`build/download-service.mjs` is a host-neutral authorization boundary, exercised
with test-only licence responses. An internal resource map selects the object;
clients cannot supply storage paths or claim their own tier. Premium access needs
an allowed decision bound to the exact file, product and site. Expired/revoked,
wrong-plan/site and unavailable cases are distinguished. Premium responses are
`private, no-store`; all bytes must match the requested digest. No licence key is
put in a URL or response. No fake authorizer or permissive default is deployed.

The real host must supply the licence-manager adapter, bounded storage reads,
request authentication, rate limiting and cache-safe HTTP handling. Whether that
host is the existing backend or a Worker remains open. Public Free/Pro preview generation, plugin preview links and Free raster media
installation are implemented locally. Website deployment and actual
licence/site/staging/multisite acceptance still need the real infrastructure. Installed Pro presence remains a capability check, not server
proof of a paid licence.

The real licence-manager integration was explicitly deferred by the user on
1 October. Keep its production adapter unconfigured until that work resumes.

### Raster images and public previews

The exporter supports approved PNG/JPEG/WebP data-URI artwork in trusted source designs. Record `image_rights` in the publishing plan, keyed by SHA-256: `{ "redistribution": true, "source": "Original artwork or licence reference", "reviewedBy": "Reviewer", "access": "free" }`. Export splits out the bytes, clears tree URLs and creates schema-2 bindings. SVG is not silently converted: keep the compact bundled source, export its raster once and review that exact derivative. `artwork_exports` maps the SHA-256 of the original image source URI to `{path, sha256, mime, evidence: {path, sha256}}`. The raster path must stay within `pilot/assets`; changed source, raster or evidence requires renewed review. Rights records are still required for the resulting raster. This avoids embedding large PNG bytes in bundled campaign payloads. Rights records are internal source files and do not appear in customer manifests.

Storage deduplicates `/assets/free/<hash>.<extension>` in the public area and `/assets/premium/<hash>.<extension>` in the private area. Premium images remain refused by the plugin while its entitlement adapter is deferred. The Homeware care pack exercises real artwork acquisition and offline use. `bin/verify-template-release.php` also simulates a next version in isolated temporary storage: unchanged artwork is reused, the original design remains addressable, and both versions retain verified local images. This rehearsal changes no site settings or campaigns.

Each selected pack also generates a content-addressed public `/previews/<hash>.html` showcase (maximum 2 MiB). It contains inert rendered screens, including result variants, rather than editable trees or the Pro renderer. Website and plugin can link to the same page. Changing previews need not copy unchanged pack JSON. Original artwork may be visible in rendered previews; only use redistributable preview-safe material. This is not DRM.

The exporter validates through the shipping pack/catalog reader before publication. R2/Worker provisioning and the real licence manager remain separate deployment tasks. Local publishing never configures a production endpoint.

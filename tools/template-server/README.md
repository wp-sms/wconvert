# WConvert Template Library

The template service: a Cloudflare Worker that serves catalogue v3, plus the
operator scripts that publish, verify, count and back it up. The wire contract
is [`docs/template-discovery-api.md`](../../docs/template-discovery-api.md); the
website's part of it is [the gallery contract](GALLERY-CONTRACT.md). This
directory is excluded from plugin packages with the rest of `tools/`.

It runs locally without a Cloudflare account. Production is Worker
`wconvert-template-api` with R2 buckets `wconvert-templates-public` and
`wconvert-templates-private`, the one hosted service while WConvert is
prelaunch (see [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md)). Local commands create no cloud
resources. Only the explicit remote commands below write to R2.

The publisher (`tools/design-library/build/publisher.mjs`, run through
`npm run templates:release:local`) owns sources, review approvals and the
release build. It writes a release directory this service reads.

## Storage layout

A release directory holds `<directory>/public/<key>` and
`<directory>/private/<key>`. A public key is exactly the URL path without its
leading slash.

| Key | Bucket | What |
| --- | --- | --- |
| `v3/manifest.json` | public | The pointer: `{schema: 3, minor, release, withdrawn, popularity?, latest_major?}`. The only mutable object. |
| `v3/releases/<sha>.json` | public | A release: `pages`, `details`, `i18n`, `taxonomy`, `collections`. |
| `v3/index/<sha>.json` | public | An index page, detail page, i18n sidecar or popularity sidecar. |
| `v3/designs/<sha>.json`, `v3/setups/<sha>.json` | public | Free design and setup objects. |
| `v3/assets/<sha>.<png\|jpg\|webp>` | public | Free images. |
| `v3/thumbs/<sha>.webp`, `v3/thumbs/<sha>@2x.webp` | public | Card thumbnails. `@2x` is named after the 1× digest. |
| `v3/og/<sha>.jpg`, `v3/previews/<sha>.html` | public | The website's Open Graph images and sandboxed previews. |
| `v3/designs/<sha>.json`, `v3/setups/<sha>.json`, `v3/assets/<sha>.<ext>` | private | Premium objects and images, served at `/v3/premium/…`. |
| `grants/<sha>.json` | private | Five-minute pass contexts, written by the Worker only. |

Every key except the pointer and the 2× thumbnail names the SHA-256 of its
exact bytes. Each script rejects a file whose bytes do not match its name, a
public object that is not Free, and any key outside this table.

### What a release must contain

Every script that reads a release (`seed`, `publish`, `backup`, the verifiers)
walks the same dependency closure (`releaseClosure` in `scripts/storage.mjs`)
and refuses the whole release on the first gap:

- the pointer's `release`, and its `popularity` sidecar if named;
- every `pages`, `details` and `i18n` digest as `v3/index/<sha>.json`, with at
  most 16 pages and 1 MiB of pages in total;
- every design entry's object, at `bytes` and `sha256`: public when `tier` is
  `free`, private otherwise, and never both. The object's `id`, `revision` and
  `tier` must match the entry. Design ids are unique across pages, and an alias
  is never a live id;
- every image a design object lists in `assets`: Free images public, premium
  images private, at most 50 per design and 20 MiB in total. A Free design binds
  only Free images, and every `image_bindings` row names a listed image;
- each design entry's `thumb` as both `v3/thumbs/<sha>.webp` (verified by
  digest) and `v3/thumbs/<sha>@2x.webp` (present and within budget);
- every setup's object, and the exact design `{id, revision}` it pins among the
  release's design entries. A Free setup pins a Free design;
- every detail's `preview`, `og` and `thumb` objects (1× and 2×).

Every `v3/releases/<sha>.json` in a directory is a retained release and is
walked too, since each one is staged for rollback.

## Rehearse locally

```sh
npm ci --prefix tools/template-server
npm run check --prefix tools/template-server
npm test --prefix tools/template-server
```

Build a release with the publisher into a new directory outside the WordPress
document root, then:

```sh
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-release none
npm run dev --prefix tools/template-server
npm run verify --prefix tools/template-server        # in another terminal
```

The service binds to `http://127.0.0.1:9454`; open `/v3/manifest.json`. The
verifier walks the release closure through HTTP, checks hashes, types, cache
headers, HEAD lengths and 304s, and confirms that premium objects are absent
from public storage and refused anonymously. `npm run test:release -- DIR` does
the same against an in-memory Workerd/R2 without a dev server.

## Updating, retrying and rolling back

To load the next build into local R2, pass the release the running service
currently serves:

```sh
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-release CURRENT_RELEASE_ID
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-release CURRENT_RELEASE_ID RETAINED_RELEASE_ID
```

The second form points the pointer at a retained release. Immutable objects are
written conditionally and read back, then the pointer is replaced with an R2
compare-and-swap. An interrupted write leaves the old pointer. Two publishers
cannot both replace the same version. Nothing deletes old files. A rollback
switches the pointer; it does not touch installed designs or existing Optins.

## Access and caching

- Public routes are an explicit list (the table above, under `/v3/`). Anything
  else is 404, a query string is 400, and any method but GET/HEAD is 405 (POST
  only on `/v3/grants`).
- The pointer is `no-cache, must-revalidate` with an ETag; `If-None-Match`
  returns 304. Everything else is `public, max-age=31536000, immutable` with an
  ETag. Errors are `no-store`.
- Caps: pointer 64 KiB, other JSON 256 KiB, HTML 2 MiB, images 5 MiB. An
  oversized stored object is 503, never served.
- Previews carry a sandbox CSP with no network and `frame-ancestors` from
  `PREVIEW_EMBED_ORIGINS`. Other responses are `default-src 'none';
  frame-ancestors 'none'`, `nosniff`, `no-referrer`.
- The v2 routes are gone, public and premium alike; a v2 object left in a bucket is never served.

## Premium grants

`POST /v3/grants` takes exactly `{"domain", "designs": [sha…], "setups": [sha…]}`
with an `X-License-Key` header: 1–50 unique digests in total. Each digest must
be stored privately under `v3/designs/` or `v3/setups/` (otherwise 404
`not_found`). The Worker builds the file list itself: each object at
`/v3/premium/(designs|setups)/<sha>.json`, plus every **premium** image a design
object lists, at `/v3/premium/assets/<sha>.<ext>`. Free images stay at
`/v3/assets/` and need no pass, so they are not in the list. Clients cannot
supply the list, permissions, product or audience.

`resource_digest` is SHA-256 over the UTF-8 JSON of `[path, sha256, bytes]`
tuples sorted by path. Nexus issues an EdDSA pass for that digest; the Worker
verifies type, issuer, audience, environment, version, store, item, permission,
site, activation, digest and a lifetime of at most 300 seconds, then answers
`{"grant", "expires_in"}`. It saves the verified claims, the public key and the
file list as `grants/<sha256(pass)>.json` in private R2: no licence key or pass.
Every GET/HEAD with `Authorization: Bearer <pass>` re-verifies the pass against
that record, checks the path is in the list, and checks the stored bytes' hash
and size. A valid pass finishes through a Nexus outage; expiry is checked on
every file. Refusal codes are those of v2 (`invalid_key`, `license_expired`,
`domain_not_allowed`, `invalid_grant`, `resource_not_allowed`, `not_found`,
`rate_limited`, …).

Signing-key discovery is bounded to 32 KiB and 5 seconds at the configured HTTPS
endpoint, with a 60-second edge cache and at most one unknown-key refresh per 30
seconds. Redirects are never followed. Without the Nexus secret, premium routes
answer 503 `service_not_configured`.

The plugin sends credentials only to its pinned origin
(`WCONVERT_TEMPLATE_API_ORIGIN`, defaulting to `templates.wconvert.io`), and only
on an explicit premium install or preview.

## Counting downloads

For every GET of `/v3/designs/<sha>.json` or `/v3/premium/designs/<sha>.json`
whose `User-Agent` starts with `WConvert template` (the plugin's
`WConvert template catalog` and Pro's `WConvert template downloads`), the Worker
writes one Analytics Engine point to the `DOWNLOADS` binding before any
storage, cache or grant work: `blobs: [sha, 'free'|'premium']`, `doubles: [1]`,
`indexes: [sha]`. No IP, domain, licence, pass or other identifier is written. A
missing or failing binding never changes the response. HEAD requests, other
agents and other paths are not counted, so the operator verifiers never count.

The dataset is `wconvert_design_downloads`.

### Popularity sidecar

```sh
npm run popularity --prefix tools/template-server -- \
  --credentials /absolute/analytics.env --output /absolute/new-popularity.json
```

This queries the Analytics Engine SQL API for the dataset:

```sql
SELECT blob1 AS sha, SUM(_sample_interval) AS downloads FROM <dataset>
WHERE timestamp > NOW() - INTERVAL '90' DAY GROUP BY sha
```

It maps digests to design ids through the live pointer's index pages (verified
by hash), adds revisions of one design together, and writes
`{"schema": 3, "generated", "downloads": {"<id>": n}}` to a new file. Digests the
live index no longer lists are reported as `unmappedDownloads`, not guessed. The
credentials file is a private regular file (mode 600) holding
`WCONVERT_ANALYTICS_API_TOKEN`, a Cloudflare API token that can read Account
Analytics. Publish the result with `--popularity` (below).

## Remote publication

The account, buckets, dataset and HTTPS origin come from `wrangler.jsonc`. The R2 credentials file is a private
regular file (mode 600) with `WCONVERT_R2_ACCESS_KEY_ID` and
`WCONVERT_R2_SECRET_ACCESS_KEY`.

```sh
npm run status --prefix tools/template-server -- --credentials /absolute/publisher.env
npm run publish --prefix tools/template-server -- --directory /absolute/release --expected CURRENT_RELEASE_ID
npm run publish --prefix tools/template-server -- --directory /absolute/release --expected CURRENT_RELEASE_ID --apply --credentials /absolute/publisher.env
```

Without `--apply`, publication validates locally and makes no network request.
`--expected` is the live release (`none` only for an empty catalogue); the
pointer is replaced only if it is still exactly the version this run read.
Private objects upload first, then public objects, each read back, then the
pointer. An uncertain write is never retried automatically: check `status`.
Nothing is deleted.

- **Rollback:** add `--retained RETAINED_RELEASE_ID` to point at an older
  release in the same directory.
- **Publish guard:** publication is refused if the new release's pages drop a
  design id that the live release lists, unless the new pointer withdraws it
  (any `withdrawn` row with that id) or a new entry keeps it in `aliases`. This
  replaces v2's `--remove-pack`. The refusal names every dropped id and happens
  before any upload.
- **Withdraw:** `--withdraw ID[@REVISION]:REASON` (repeatable; reason `rights`,
  `quality`, `broken` or `other`) adds a row to the new pointer. Used with
  `--directory` it satisfies the guard; used alone with `--expected` it
  republishes the live pointer with the same release.
- **Withdrawals carry over.** The new pointer keeps every live withdrawal, even
  if the release directory's pointer does not list it, so a rebuild cannot
  quietly undo one. Only `--reinstate ID[@REVISION]` (exactly the row's id and
  revision) removes a row.
- **Popularity:** `--popularity /absolute/sidecar.json` uploads the sidecar as
  `v3/index/<sha>.json` and points the pointer at it, alone or with a release.
  A release whose own pointer names no sidecar keeps the live one.

```sh
npm run publish --prefix tools/template-server -- --expected CURRENT_RELEASE_ID \
  --withdraw old-design:rights --popularity /absolute/new-popularity.json --apply --credentials /absolute/publisher.env
```

After publishing to a deployed service:

```sh
npm run verify:remote --prefix tools/template-server -- --expected CURRENT_RELEASE_ID --premium configured
```

This read-only check walks the public closure over HTTPS and requires anonymous
premium requests to return 401 (`--premium configured`) or 503 (the default, for
a service without its Nexus secret). It sends no licence and does not prove a
licensed download.

## Request limits

Shared hosting puts many sites behind one IP, so the tight counters are per site
and the IP only has a loose ceiling:

| Binding | Key | Limit |
| --- | --- | --- |
| `GRANT_IP_RATE_LIMITER` | connecting IP | 600 POST `/v3/grants` a minute |
| `GRANT_RATE_LIMITER` | IP + SHA-256 of the lower-cased `domain` | 30 a minute |
| `DOWNLOAD_IP_RATE_LIMITER` | connecting IP | 6000 premium GET/HEAD a minute |
| `DOWNLOAD_RATE_LIMITER` | SHA-256 of the bearer pass | 1000 a minute |

The per-site grant counter runs after the body is parsed and validated, before
the licence check, storage or Nexus. A file request without a well-formed pass
skips the pass counter and is refused 401 without a storage read. Keys use
Cloudflare's `CF-Connecting-IP`; limits are approximate per Cloudflare location.
Public routes use no counter. An exhausted counter answers 429 with
`Retry-After: 60` and `private, no-store`; a missing or failing binding answers
503 `rate_limit_unavailable` (fail closed). Nexus keeps its own issuance limits.
See [Cloudflare rate limiter semantics](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

A bounded live probe of the per-site counters (the IP ceilings are too high to
reach with it). Wait at least 65 seconds after its last request before checking
recovery:

```sh
npm run verify:limits --prefix tools/template-server -- --phase burst
npm run verify:limits --prefix tools/template-server -- --phase recovery
```

It sends a well-formed batch with no licence and a made-up pass: no Nexus call,
no credential. It temporarily consumes the probe IP's premium allowance.

## Backup and recovery

```sh
npm run backup --prefix tools/template-server -- \
  --credentials /private/template-publisher.env --directory /private/backups/new-snapshot
npm run rehearse:recovery --prefix tools/template-server -- /private/backups/new-snapshot
```

Backup reads the pointer, lists every retained `v3/releases/`, walks each
closure (public and private), and refuses a pointer change during capture. It
writes an exclusive destination outside any WordPress document root (files
0600, directories 0700) and a `backup.json` inventory with every file's SHA-256
and size, which is the only record of each 2× thumbnail's digest. Grants,
passes, licences, Worker secrets, Cloudflare settings, Nexus data and v2 objects
are not backed up.

Rehearsal checks every file against that inventory, restores into fresh local
Workerd/R2, verifies the service and private isolation, rolls back to each
retained release and forward again, then restores the current pointer. Only this
local rehearsal withdraws dropped designs automatically (reason `other`) and
reinstates them on the way back. It never writes production.

For a real recovery, provision the Worker, bindings and secret first, then use
the remote publisher with the backup as its release directory and its normal
`--expected` guard, and run remote and licensed WordPress acceptance. A local
snapshot is not off-site disaster recovery.

## WordPress acceptance

```sh
npm run test:wordpress --prefix tools/template-server -- /absolute/release-directory
npm run test:wordpress --prefix tools/template-server -- --remote CURRENT_RELEASE_ID
```

These boot a disposable PHP 8.1 WordPress (Playground) and run the plugin's own
verifier: `bin/verify-template-release.php` for a local directory,
`bin/verify-template-api.php` against the live service. The runner refuses to
start if that verifier is not in the checkout.

## Status

The v2 service went live at `https://templates.wconvert.io` on 18–20 October
2026 (see [the connection evidence](../../docs/reviews/nexus-worker-connection-2026-10-19.md)
and [launch evidence](../../docs/reviews/template-launch-2026-10-20/README.md)).
The v3 Worker, bindings and data in this directory are not yet deployed or
published. Local simulation is evidence of behaviour, not of a deployed
service. Regenerate `Env` with `npm run types` after changing `wrangler.jsonc`,
which must stay plain JSON: the scripts parse it with `JSON.parse`.

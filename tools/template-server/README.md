# WConvert Template Library

This is the template API, separate from the plugin customer UI. It is excluded from plugin packages with the rest of `tools/`. It runs locally without a Cloudflare account. One hosted environment uses Worker `wconvert-template-api` and private R2 buckets `wconvert-templates-public` and `wconvert-templates-private`; local development emulates those bindings without contacting Cloudflare. Local commands do not create cloud resources or change site settings. The explicit remote publishing command below writes to the configured R2 buckets.

The existing studio still owns sources and review approvals. `templates:release:local` builds a validated, immutable release. This service reads its public and private objects through separate R2 bindings. Local development emulates those bindings on disk. The hosted Worker uses the same handler with the two real private R2 buckets.

## Rehearse locally

From the plugin repository, install the isolated tooling once:

```sh
npm ci --prefix tools/template-server
npm run check --prefix tools/template-server
npm test --prefix tools/template-server
```

Build an approved release outside the WordPress document root, using a new directory for the first rehearsal:

```sh
npm run templates:release:local -- \
  --directory /tmp/wconvert-template-release \
  --origin https://templates.example --expected none
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-release none
npm run dev --prefix tools/template-server
```

In another terminal:

```sh
npm run verify --prefix tools/template-server
```

The service binds to `http://127.0.0.1:9454`. Open `/manifest.json` for the catalogue. The verifier follows its pages, checks exact hashes, downloads Free packs/images, checks public Free/Pro previews and confirms premium downloads are refused. For manual preview, take a `preview_url` from a catalogue page and replace only its origin with `http://127.0.0.1:9454`.

`https://templates.example` remains the **metadata origin**, not a real host. The local service mirrors its paths. Do not configure this HTTP mirror in the plugin: the production reader deliberately requires HTTPS. The native local-release verifier remains an isolated fixture check; `npm run test:wordpress --prefix tools/template-server -- --remote CURRENT_RELEASE_ID` uses real WordPress HTTP requests to the configured HTTPS API and temporary installation storage. No production URL is configured by this tool.

The current rehearsal serves four Free packs (16 setups), five public previews including the premium pack, and one Free image. The complete release still lists 22 setups; six premium setups require the Nexus configuration described below; no permissive authorizer is enabled by default. All 34 rendered preview screens/results were exercised through the service's actual CSP and device controls.

## Updating, retrying and rolling back

The local release builder requires the previous release ID, preserves immutable pack versions and writes its manifest last. To load its next output into local R2, supply the ID currently returned by the running service:

```sh
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-release CURRENT_RELEASE_ID
```

The seed tool validates the public and private dependency closures of every retained release before writing anything, including the pages, packs, previews and images needed for rollback. It refuses premium source in public packs, checks file sizes/hashes, writes immutable objects conditionally, reads every object back, then conditionally replaces `manifest.json`. An interrupted write leaves the old manifest in place. Concurrent publishers cannot both replace the same version. An identical retry reuses the existing objects. Nothing deletes old files.

For a local rollback, choose a retained release in the same validated output directory:

```sh
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-release CURRENT_RELEASE_ID RETAINED_RELEASE_ID
```

This switches the catalogue pointer; it does not rewrite installed templates or existing campaigns. The command only accesses local Wrangler storage. `scripts/storage.mjs` provides a tested R2-compatible conditional promotion operation, and the remote publishing CLI uses that same operation. There is no public write endpoint.

## Access and caching

- The Worker has separate public and private bucket bindings. Private files are served only after Nexus grant verification; bucket paths and temporary grant records have no public routes.
- Catalogue, Free packs, public previews and Free images have explicit route patterns. Arbitrary file paths, queries and write methods are refused.
- With missing Nexus configuration, Premium routes return `503` and `private, no-store`. Configured routes verify an Ed25519 Nexus pass on every GET/HEAD/retry, including a conditional request. No client tier header or fake authorizer enables access.
- Immutable files have long-lived caches and ETags. The mutable manifest must revalidate. Missing/unavailable responses are not cached.
- HTML demos use an isolated sandbox CSP, disabled sample forms, no external network resources and no referrer. Public previews are viewable demonstrations, not editable premium source or DRM.

## Local Nexus integration (18 October 2026)

`POST /grants` accepts only `{pack: <pack hash>, domain: <SDK canonical site>}`
and an `X-License-Key` header. WordPress obtains the key through the existing Pro
SDK, only during an explicit premium preview/install. The Worker loads the trusted
immutable pack and computes SHA-256 over UTF-8 JSON of `[path, sha256, bytes]`
tuples sorted by path, covering the pack and exact permitted images. Clients may
not supply membership, permissions, product or audience.

Nexus issues the signed pass. The Worker verifies EdDSA/type, issuer, audience,
environment, protocol, WConvert store/item/permission, site, activation shape,
resource digest and bounded lifetime. After verification it saves the signed
subject/activation/resource context and public verification key under
`grants/<sha256(pass)>.json` in private R2. No licence key or pass is stored there.
This trusted record supplies expected claims on every subsequent private request;
it also lets valid passes finish through Nexus/key-server outages. R2's strong
read-after-write consistency avoids a just-issued pass being temporarily missing.
The records are not a licence database. They never override Nexus decisions.
Expiry is checked on every file, even while the record awaits lifecycle cleanup.

Signing-key discovery is bounded to 32 KiB/5 seconds at the configured HTTPS
endpoint, with a 60-second edge cache and at most one unknown-key refresh per
30 seconds per edge cache. A newly rotated key during that interval may briefly
return a retryable error. Redirects are never followed. Expired passes require a
new Nexus decision; plugin downloads retry an expired pass once. Network failures,
service configuration errors and Nexus outages fail closed; they never claim an
expired licence. 429/503 Retry-After values suppress repeated plugin requests for
the indicated bounded interval. Grant issuance and file delivery have separate backoff scopes, so an issuance outage does not interrupt already authorized files. Managed-key sites receive a manager-directed refusal without renewal/activation details. There is no sleeping PHP retry loop.

The plugin uses an independently configured HTTPS origin constant
`WCONVERT_TEMPLATE_API_ORIGIN` before sending any credential. Public catalogue,
preview and Free reads never send credentials or call Nexus. Premium pack/images
keep the existing digest/type/dimension checks and complete-set installation.
Passes live only in the WordPress request's memory, never admin responses, URLs,
catalogue options or logs. Installed content stays available offline.

Run `npm test --prefix tools/template-server` for real Workerd/R2/WebCrypto tests
with a test-only Nexus responder. `TemplateDownloadsTest` exercises the WordPress
transport and SDK. `bin/verify-template-downloads.php` rehearses boot, real container
wiring, premium pack/media installation and offline use in disposable WordPress.
Run `npm run test:wordpress --prefix tools/template-server` for that disposable
PHP 8.1 rehearsal (root Composer/Pro packages and npm dependencies are required).
No test responder ships in the Worker or plugin. The service remains closed until
real configuration is supplied. The original `verify` command still expects this
unconfigured local service; it does not test a live licensed deployment.

## Remote publication

The account, bucket names and HTTPS origin come from `wrangler.jsonc`. Build the release for that exact origin, outside the WordPress document root. The credential file must be an absolute path to a private regular file (mode 600), with `WCONVERT_R2_ACCESS_KEY_ID` and `WCONVERT_R2_SECRET_ACCESS_KEY`.

```sh
npm run status --prefix tools/template-server -- --credentials /absolute/publisher.env
npm run publish --prefix tools/template-server -- --directory /absolute/release --expected CURRENT_RELEASE_ID
npm run publish --prefix tools/template-server -- --directory /absolute/release --expected CURRENT_RELEASE_ID --apply --credentials /absolute/publisher.env
```

Use `--expected none` only for an empty remote catalogue. Without `--apply`, publication validates locally and makes no network request. For rollback add `--retained RETAINED_RELEASE_ID` to the same command. Private dependencies are uploaded first; public dependencies are checked before the conditional manifest replacement. An uncertain write is never retried automatically: inspect status first. No objects are deleted.

After Worker deployment, run `npm run verify:remote --prefix tools/template-server -- --expected CURRENT_RELEASE_ID`. This read-only check expects Nexus to remain unconfigured, tests Free content and public previews, and requires premium requests to fail closed.

## Hosted setup status

Follow [the Cloudflare preparation checklist](CLOUDFLARE-SETUP.md). It lists the
account/domain decisions, two private buckets, grant-record lifecycle rule, Nexus
handoff, secrets and remaining hosted acceptance. The remote publisher uploaded and verified the first release on 18 October 2026. The Worker and custom domain are live. Free/public HTTPS acceptance and real WordPress installation/offline checks passed on 18 October 2026. Nexus remains disconnected.

Local simulation is evidence of behaviour, not evidence of a deployed service. Wrangler's local administrative explorer is a development-only surface; keep the development server loopback-only.

References: [R2 Workers API and conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [local development data](https://developers.cloudflare.com/workers/local-development/local-data/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/). Versions are pinned in the separate lockfile; regenerate `Env` with `npm run types` after config changes.

The hosted WordPress check does not change persistent site options or send a licence. It downloads Free packs through the shipping transport, verifies their images, confirms premium refusal, and simulates an outage after installation. The plugin default catalogue URL remains unset; deploying the service does not automatically enable it for all installations.

# Template staging service

This is the internal delivery service, separate from the plugin customer UI. It is excluded from plugin packages with the rest of `tools/`. It runs locally without a Cloudflare account. No R2 bucket, DNS record, Worker deployment, licence integration or site setting is created by these commands.

The existing studio still owns sources and review approvals. `templates:release:local` builds a validated, immutable release. This service reads its public objects through an R2 binding. Local development emulates that binding on disk; later the same read handler can use a real private R2 bucket exposed only through the Worker.

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
  --directory /tmp/wconvert-template-staging \
  --origin https://templates.example --expected none
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-staging none
npm run dev --prefix tools/template-server
```

In another terminal:

```sh
npm run verify --prefix tools/template-server
```

The service binds to `http://127.0.0.1:9454`. Open `/manifest.json` for the catalogue. The verifier follows its pages, checks exact hashes, downloads Free packs/images, checks public Free/Pro previews and confirms premium downloads are refused. For manual preview, take a `preview_url` from a catalogue page and replace only its origin with `http://127.0.0.1:9454`.

`https://templates.example` remains the **metadata origin**, not a real host. The local service mirrors its paths. Do not configure this HTTP mirror in the plugin: the production reader deliberately requires HTTPS. The native local-release verifier remains the WordPress installation/offline check; HTTPS staging-to-plugin acceptance is a later deployment check. No production URL is configured by this tool.

The current rehearsal serves four Free packs (16 setups), five public previews including the premium pack, and one Free image. The complete release still lists 22 setups; six premium setups cannot be downloaded here. All 34 rendered preview screens/results were exercised through the service's actual CSP and device controls.

## Updating, retrying and rolling back

The local release builder requires the previous release ID, preserves immutable pack versions and writes its manifest last. To load its next output into local R2, supply the ID currently returned by the running service:

```sh
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-staging CURRENT_RELEASE_ID
```

The seed tool validates the public dependency closure of every retained release before writing anything, including the pages, packs, previews and images needed for rollback. It refuses premium source in public packs, checks file sizes/hashes, writes immutable objects conditionally, reads every object back, then conditionally replaces `manifest.json`. An interrupted write leaves the old manifest in place. Concurrent publishers cannot both replace the same version. An identical retry reuses the existing objects. Nothing deletes old files.

For a local rollback, choose a retained release in the same validated output directory:

```sh
npm run seed --prefix tools/template-server -- /tmp/wconvert-template-staging CURRENT_RELEASE_ID RETAINED_RELEASE_ID
```

This switches the catalogue pointer; it does not rewrite installed templates or existing campaigns. The command only accesses local Wrangler storage. `scripts/storage.mjs` provides a tested R2-compatible conditional promotion operation, but no remote publishing credentials, upload command or public write endpoint is supplied.

## Access and caching

- The Worker has **only a public-content bucket binding**. It cannot read a private pack or original image.
- Catalogue, Free packs, public previews and Free images have explicit route patterns. Arbitrary file paths, queries and write methods are refused.
- Premium pack/image routes return `503`, `no-store` and an explicit message that licence integration is pending. Client-supplied tokens or tier headers cannot enable them. No fake authorizer is shipped.
- Immutable files have long-lived caches and ETags. The mutable manifest must revalidate. Missing/unavailable responses are not cached.
- HTML demos use an isolated sandbox CSP, disabled sample forms, no external network resources and no referrer. Public previews are viewable demonstrations, not editable premium source or DRM.

## When R2 is available

1. Create a staging bucket with public `r2.dev` access disabled. Confirm the account, bucket names and HTTPS API domain; the config's names are proposed names only.
2. Configure a staging route and environment. Both `workers.dev` and preview deployment URLs are disabled by default. No production environment is defined.
3. Add an authenticated operator-side publisher using the existing validated release and conditional promotion operation. Preserve immutable-version/access-scope checks across retained releases; the local filesystem builder currently supplies those checks. Do not add an unauthenticated upload route.
4. Verify the live HTTPS catalogue and Free download/install/update/offline/rollback path in a disposable WordPress site. Exercise cache, storage outage, operational logging and restore from backup. Apply deployment-specific request limits before public launch.
5. Connect the existing licence manager later, with its real product, activation, expiry and staging-site rules. Only then add private storage and enable premium download routes.

Local simulation is evidence of behaviour, not evidence of a deployed service. Wrangler's local administrative explorer is a development-only surface; keep the development server loopback-only.

References: [R2 Workers API and conditional operations](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/), [local development data](https://developers.cloudflare.com/workers/local-development/local-data/), [Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/). Versions are pinned in the separate lockfile; regenerate `Env` with `npm run types` after config changes.

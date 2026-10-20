# Set up WConvert Template Library

There is one hosted service, `templates.wconvert.io`, while WConvert is
prelaunch; there is no staging copy. Local development stays in Wrangler's
on-disk emulator. On 18 October 2026 the two production R2 buckets were populated and
verified through the scoped publisher credentials; the operator deployed the
Worker and domain, and live HTTPS and disposable WordPress acceptance passed.
Nexus was connected on 19 October; live refusal checks and real licensed
WordPress acceptance passed. All of that was catalogue v2. **Catalogue v3 (this
directory) is not yet deployed or published.**

## Names to use

| Purpose | Name |
| --- | --- |
| Cloudflare Worker | `wconvert-template-api` |
| Free files and public previews bucket | `wconvert-templates-public` |
| Premium files and temporary passes bucket | `wconvert-templates-private` |
| HTTPS address | `templates.wconvert.io` |
| Analytics Engine dataset (`DOWNLOADS`) | `wconvert_design_downloads` |
| Rate-limit namespaces | `202610211`–`202610214` |
| Nexus audience | `https://templates.wconvert.io` |

“Public” describes what the Worker may serve anonymously. **Both buckets stay
private**: disable Public Development URL/r2.dev and attach no bucket custom
domains. Only the Worker serves files.

## Current setup and remaining work

Account: `c1a1ad8e669eb8c31ce039ea78aa6ab9`. Production bucket names and custom
domain are configured in `wrangler.jsonc`. Direct bucket access being disabled
and the one-day `grants/` lifecycle are operator-confirmed for production; the
object-only publisher cannot audit those settings.

The R2 publisher credentials are in the operator-only file
`~/.config/wconvert/template-publisher.env`, outside this repository. Never copy
them into the Worker. See the README for publication commands.

Before v3 goes live:

1. **Deploy the v3 Worker from Git** (*Deploying*, below), or by hand with
   `npx wrangler deploy` from this directory. The four rate
   limiters and the `DOWNLOADS` dataset are declared in `wrangler.jsonc`; a
   dashboard paste of `dist/index.js` does not create them, and a Worker
   without them refuses every premium request (503, fail closed) and counts
   nothing. The four namespaces are new: they replace the two v2 counters
   (`202610201`, `202610202`), whose keys no longer apply.
2. **Analytics Engine** must be available on the account for the dataset
   binding. A dataset is created by the first point written to it.
3. **Popularity token**: create a Cloudflare API token with Account Analytics
   Read for this account, and keep it as `WCONVERT_ANALYTICS_API_TOKEN` in a
   private (mode 600) operator credentials file. It is used only by
   `npm run popularity`, never by the Worker.
4. **Publish the first v3 release** with `npm run publish -- --expected none`
   (the v3 pointer `v3/manifest.json` does not exist yet, even where v2 data
   does), then run `npm run verify:remote`.

## Setup sequence (production R2 and Worker steps completed for v2)

1. Choose the Cloudflare account and final HTTPS address. A Worker custom domain
   requires its DNS zone in that account. Choose the address before connecting
   Nexus: the signed audience must match that exact address.
2. Enable R2 and create the buckets above. Leave direct public access disabled.
   `wrangler.jsonc` declares their bindings, but does not create them.
3. On each private bucket, add a lifecycle rule deleting only the `grants/`
   prefix after one day. These records contain verified download context (the
   claims, the public key and the batch's file list), not licence keys or raw
   passes. Access expires at the signed expiry (at most five minutes),
   regardless of cleanup. Do not delete `v3/` (or the remaining v2 objects) on a
   timer: retained releases and older installed revisions may still need them.
4. In Nexus **Catalog → Downloads**, connect the server to Premium templates
   (`templates:download`, WConvert Pro). Copy the grant URL, public-key URL,
   issuer, signed environment, exact audience and one-time service key. Use the
   values Nexus actually provides.
5. Keep the service key in Worker secret storage. Never put it in the plugin,
   release JSON, Git, a GitHub comment or a conversation. Runtime R2 access uses
   bindings; no R2 S3 key belongs in the Worker or plugin. Publishing
   credentials belong to the operator and must be scoped to these buckets.

## Configuration and deployment checklist

Set the Worker runtime compatibility date to `2026-10-01`, matching the
supported date confirmed in the dashboard and the tested Wrangler configuration.
Local `wrangler dev`, tests and dry-run builds use emulated storage and upload
nothing.

### Deploying (from Git only)

Keep `wrangler.jsonc` plain JSON, with no comments: the publish, verify and test
scripts read it with `JSON.parse`.

`.github/workflows/template-service.yml` deploys the Worker. A merge to `main`
that touches `tools/template-server/**` deploys `templates.wconvert.io` after
its tests pass; the workflow can also be run by hand. Do not paste code into
the dashboard: the live service must be a commit on `main`, and the next deploy
overwrites a pasted one. A deploy changes Worker code only. Catalogue data
still goes out through `npm run publish`.

One-time operator setup:

1. Create a Cloudflare API token with **Workers Scripts: Edit**, **Workers Routes:
   Edit** (zone `wconvert.io`) and **Account Settings: Read**.
2. In GitHub → Settings → Environments, create `template-service` and add the
   token as `CLOUDFLARE_API_TOKEN`. Add a reviewer rule there if you want a
   deploy to wait for approval; the workflow needs no change.

For deployments and the Nexus connection:

- Authenticate Wrangler locally to the account.
- The Nexus endpoints, issuer, audience and the `production` environment claim
  are set in `wrangler.jsonc`. Keep `workers_dev` and
  preview URLs disabled.
- Run `wrangler secret put NEXUS_SERVICE_KEY` from `tools/template-server`. Keep the value out of source files and command
  arguments.
- Rate limits for `/v3/grants` and premium files are Worker bindings (README,
  *Request limits*). Nexus separately limits issuance. Redact Authorization,
  X-License-Key, request bodies and passes in infrastructure logs. Never add
  credentials to URLs.
- Publish only through `scripts/publish-remote.mjs`: private and public objects
  are uploaded and read back first, then `v3/manifest.json` is replaced by
  compare-and-swap. Keep retained releases for rollback. There is no public
  upload route.
- Test the real HTTPS route with valid, expired, disabled and inactive-site
  licences, managed keys, local/subdirectory/multisite identities, key rotation,
  a batch of several premium designs, interrupted downloads, outages and retry.
  Check Free access and public previews without credentials, premium images,
  and offline installed campaigns.
- Verify rollback, the publish guard and backup/restore before customers depend
  on v3.

## Verified service and remaining checks (v2)

The production buckets and Worker serve the reviewed v2 release at
`https://templates.wconvert.io`. The operator connected Nexus on 19 October and
live issuance-refusal checks passed. Real licensed WordPress acceptance also
passed with WooCommerce. The remote publisher passed a real R2 upload, full
read-back, unchanged retry and stale-publication refusal. The 20 October launch
work published service privacy/terms, checked bucket isolation and grant
cleanup, and rehearsed a complete retained-catalogue restore into fresh local
storage. None of these checks has been repeated for v3.

References: [Create R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/),
[Worker bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/),
[Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/),
[Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/),
[Workers Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/),
[Nexus handoff](https://github.com/veronalabs/nexus/issues/1246#issuecomment-6233517224).

## Before enabling premium downloads or launching

Nexus is connected and the core live licence flow is verified for v2.
Whole-licence expiry/revocation on dedicated disposable licences remain separate
acceptance scenarios. Service disclosures are published at
[privacy](https://wconvert.io/privacy/) and [terms](https://wconvert.io/terms/).
The v3 download count writes no IP, domain, licence or pass; check those
disclosures still describe the service before v3 goes live.

On 20 October, Chrome dashboard inspection confirmed both production R2 buckets
have public access disabled, the private bucket has no custom domain,
`workers.dev` is disabled, and the enabled private-bucket lifecycle rule
`cleanup-download-grants` deletes objects under `grants/` after one day. The
deployment API also confirmed both `workers.dev` and preview URLs disabled. The
zone shows Free with one WAF rate-rule slot, so Worker bindings provide the
counters without a plan upgrade.

The v2 restore rehearsal recovered 23 public and three private objects, checked
three retained releases, rolled back both older versions, and restored the
current pointer in fresh local Workerd/R2. See
[recovery evidence](../../docs/reviews/template-launch-2026-10-20/recovery.json).
Live request-limit verification passed for the two v2 counters on 20 October
([launch evidence](../../docs/reviews/template-launch-2026-10-20/README.md));
rerun `npm run verify:limits` against the four v3 counters after deploying.

## Nexus dashboard connection — 19 October 2026

The custom API hostname differs from the signed issuer. The Worker accepts that
pairing: grant and public-key URLs must share an API origin, and the signed
issuer is checked separately and must match exactly. The production values are:

| Text variable | Value |
| --- | --- |
| `NEXUS_GRANT_URL` | `https://my.wconvert.io/api/v1/wconvert/entitlements/grant` |
| `NEXUS_KEYS_URL` | `https://my.wconvert.io/api/v1/wconvert/entitlements/keys` |
| `NEXUS_ISSUER` | `https://nexus.veronalabs.com` |
| `NEXUS_AUDIENCE` | `https://templates.wconvert.io` |
| `NEXUS_ENVIRONMENT` | `production` |

`NEXUS_SERVICE_KEY` is a **Secret**, pasted directly from Nexus. Store `wconvert`,
item `wconvert-pro` and permission `templates:download` are enforced in the
Worker; there is no collection variable. The service key must be authorized for
this collection in Nexus. v3 changes only the `resource_digest`'s input (the
batch's file list), not the claims Nexus signs.

After deployment, `npm run verify:remote -- --expected RELEASE_ID --premium configured`
checks public files and anonymous premium refusals. It does **not** prove that
Nexus accepts the service key or that a licensed download works.

### Website gallery configuration

`PREVIEW_EMBED_ORIGINS` is:

```text
https://wconvert.io https://www.wconvert.io https://dev.wconvert-website.pages.dev
```

Use exact origins
without paths or trailing slashes; other Pages branches and localhost stay
blocked. Remote publication refuses a release that drops a live design id
unless the new pointer withdraws it (`--withdraw ID:REASON`); `--expected` still
guards concurrent publishers. Merging Git changes does not change the hosted
Worker or catalogue.

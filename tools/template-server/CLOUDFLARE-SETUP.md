# Set up WConvert Template Library

We will start with **one hosted environment**, using its intended final name.
WConvert is prelaunch, so this environment can be tested before customers depend
on it. Local development remains isolated in Wrangler's on-disk emulator. A
separate staging environment can be added later when changes need testing without
affecting a live customer service. On 18 October 2026 the two existing R2 buckets were successfully populated and verified through the scoped publisher credentials. The operator deployed the Worker and domain; live HTTPS and disposable WordPress acceptance passed. Nexus was connected by the operator on 19 October; live refusal checks and real licensed WordPress acceptance pass.

## Names to use

| Purpose | Name |
| --- | --- |
| Service | WConvert Template Library |
| Cloudflare Worker | `wconvert-template-api` |
| Free files and public previews bucket | `wconvert-templates-public` |
| Premium files and temporary passes bucket | `wconvert-templates-private` |
| Suggested final HTTPS address | `templates.wconvert.io` (domain ownership confirmed by operator) |

“Public” describes what the Worker may serve anonymously. **Both buckets stay
private**: disable Public Development URL/r2.dev and do not attach bucket custom
domains. Only the Worker serves files. Free downloads and previews need no licence;
premium source files require Nexus authorization.

## Current setup and remaining work

Account: `c1a1ad8e669eb8c31ce039ea78aa6ab9`. Bucket names and custom domain are configured in `wrangler.jsonc`. Direct bucket access being disabled and the one-day `grants/` lifecycle are operator-confirmed; the object-only publisher cannot audit those settings.

The R2 publisher is implemented. Credentials are in the operator-only file `~/.config/wconvert/template-publisher.env`, outside this repository. Never copy them into the Worker. See the README for publication commands.

## Setup sequence (R2 and Worker steps completed)

1. Choose the Cloudflare account and final HTTPS address. A Worker custom domain
   requires its DNS zone in that account. Share the account ID and chosen address,
   not passwords. Choose the address before connecting Nexus: the signed audience
   must match that exact address.
2. Enable R2 and create the two buckets above. Leave direct public access disabled.
   `wrangler.jsonc` already declares their bindings, but does not create them.
3. On `wconvert-templates-private`, add a lifecycle rule deleting only the
   `grants/` prefix after one day. These records contain verified download context,
   not licence keys or raw passes. Access expires at the signed expiry (at most
   five minutes), regardless of cleanup. Do not delete `packs/` or `assets/` on a
   timer: older installed versions and retained releases may still need them.
4. In Nexus **Catalog → Downloads**, connect this server to Premium templates
   (`templates:download`, WConvert Pro). Copy the grant URL, public-key URL,
   issuer, signed environment, exact audience and one-time service key. Use the
   values Nexus actually provides. The environment claim describes the Nexus
   installation; it is not determined by whether WConvert has launched.
5. Keep the service key in Worker secret storage. Never put it in the plugin,
   release JSON, Git, a GitHub comment or this conversation. Runtime R2 access
   uses bindings; no R2 S3 key belongs in the Worker or plugin. Publishing
   credentials belong to the operator and must be scoped to these buckets.

The useful non-secret details to share are: Cloudflare account ID, final Worker
address, bucket names, Nexus URLs, issuer, environment and audience. Install the
service key locally when ready.

## Configuration and deployment checklist

Set the Worker runtime compatibility date to `2026-10-01`, matching the supported date confirmed in the dashboard and our tested Wrangler configuration.

The default Wrangler configuration is the single hosted environment. **Do not use
`--env staging`**; no such environment is configured. Local `wrangler dev`, tests
and dry-run builds use emulated storage and do not upload files.

For deployments and the Nexus connection:

- Authenticate Wrangler locally to the chosen account.
- The operator-provided Nexus endpoints, issuer, audience and the handoff’s
  `production` environment are now set in `wrangler.jsonc`. The Worker custom domain and account configuration are already present. Keep `workers_dev` and preview URLs disabled.
- Run `wrangler secret put NEXUS_SERVICE_KEY` from `tools/template-server`.
  Keep the value out of source files and command arguments; the dashboard Secret field is an alternative.
- Require HTTPS and configure request limits for `/grants` and private file
  requests before exposing the service. Nexus separately limits issuance.
  Redact Authorization/X-License-Key, request bodies and passes in infrastructure
  logs. Never add credentials to URLs.
- Use the authenticated remote publisher in `scripts/publish-remote.mjs`. Upload and verify private/public dependencies first, then
  conditionally promote `manifest.json` last. Keep retained versions for rollback;
  a partial upload must leave the old catalogue usable. No public upload route.
- Configure a disposable WordPress installation with catalogue option
  `wconvert_template_catalog_url = https://<worker>/manifest.json` and wp-config
  constant `WCONVERT_TEMPLATE_API_ORIGIN = https://<worker>`. The independent
  origin prevents an editable catalogue from choosing where credentials go.
  Use no trailing slash or path for this constant.
- Test the real HTTPS route with valid, expired, disabled and inactive-site
  licences, managed keys, local/subdirectory/multisite identities, key rotation,
  interrupted downloads, outages and retry. Check Free access and public previews
  without credentials, premium images, and offline installed campaigns.
- Verify rollback and backup/restore before making this service available to
  customers. Remove test-only catalogue content before launch.

No second set of buckets or second Nexus connection is required for this initial
prelaunch environment. Once customers depend on it, use a separate test
configuration, storage and Nexus connection for risky changes. Never let local
fixtures or staging credentials target live buckets.

## Verified service and remaining checks

The buckets and Worker serve the reviewed release at `https://templates.wconvert.io`. The operator connected Nexus on 19 October and live issuance-refusal checks passed. Real licensed WordPress acceptance also passed with WooCommerce. The default plugin catalogue connection and the protected-image download/install path are verified. The remote publisher has passed a real R2 upload, full read-back, unchanged retry and stale-publication refusal. The 20 October launch work published service privacy/terms, checked bucket isolation and grant cleanup, and rehearsed a complete retained-catalogue restore into fresh local storage.
Local tests run the actual Worker/WebCrypto/R2 runtime with a test Nexus responder;
the remote WordPress verifier uses real HTTPS for Free installation and simulated failure only for the offline check. The separate Nexus WordPress tests intercept HTTP; the real WordPress → Worker → Nexus licensed route passed on 19 October using a disposable activated site and the actual premium pack.

References: [Create R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/),
[Worker bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/),
[Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/),
[Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Nexus handoff](https://github.com/veronalabs/nexus/issues/1246#issuecomment-6233517224).

## Before enabling premium downloads or launching

Nexus is connected and the core live licence flow is verified. Whole-licence expiry/revocation on dedicated disposable licences remain separate acceptance scenarios. Service disclosures are now published at [privacy](https://wconvert.io/privacy/) and [terms](https://wconvert.io/terms/), with links in the plugin readme and catalogue disclosure.

On 20 October, Chrome dashboard inspection confirmed both R2 buckets have public access disabled, the private bucket has no custom domain, `workers.dev` is disabled, and the enabled private-bucket lifecycle rule `cleanup-download-grants` deletes objects under `grants/` after one day. That lifecycle is storage cleanup, not pass expiry; the Worker enforces the much shorter authorization expiry. The deployment API also confirmed both `workers.dev` and preview URLs disabled. Both rate limiter bindings are saved in Cloudflare and declared in Wrangler; Worker version `cd421d7d-aae9-4073-8d54-645691706de8` deploys enforcement to 100% of traffic. Their limits and verification procedure are in the [service README](README.md#request-limits-and-recovery). The zone currently shows Free with one WAF rate-rule slot, so Worker bindings provide the two independent counters without a plan upgrade.

The restore rehearsal recovered 23 public and three private objects, checked three retained releases, rolled back both older versions, and restored the current pointer in fresh local Workerd/R2. No production rollback or data deletion occurred. A local snapshot is not an offsite disaster-recovery system: separately protect a copy and the secrets/account/Nexus recovery procedures. See [recovery evidence](../../docs/reviews/template-launch-2026-10-20/recovery.json).

Live request-limit verification passed on 20 October: both counters returned
429 with `Retry-After: 60`, premium-image HEAD shared the download counter,
the grant and download scopes were independent, and the public manifest
remained available. After cooldown, normal 400/401 validation responses returned
and full live catalogue verification passed. See the
[launch evidence](../../docs/reviews/template-launch-2026-10-20/README.md).


## Nexus dashboard connection — 19 October 2026

The custom API hostname differs from the signed issuer. Deploy the updated Worker
code as well as setting its variables; the previous build rejected that pairing.
The operator confirmed dashboard deployment on 19 October. Live Free installation, premium refusals, real licensed installation with
WooCommerce and natural pass expiry checks pass. The temporary test activation
was removed afterward. See the [connection evidence](../../docs/reviews/nexus-worker-connection-2026-10-19.md).

1. Open **Workers & Pages → wconvert-template-api → Edit code**.
   Build the current checkout with `npm run build` from `tools/template-server`.
   Replace the entry module with `dist/index.js` (omit its final source-map comment),
   then **Deploy**. The previously prepared `worker.js` is a copy of that bundle.
   Keep compatibility date `2026-10-01` and both existing R2 bindings.
2. Under **Settings → Variables and Secrets**, add the five Text values below.
3. Add `NEXUS_SERVICE_KEY` as type **Secret**, pasting the server key directly
   from Nexus. Save/deploy the settings. No key belongs in `worker.js`.

| Text variable | Value |
| --- | --- |
| `NEXUS_GRANT_URL` | `https://my.wconvert.io/api/v1/wconvert/entitlements/grant` |
| `NEXUS_KEYS_URL` | `https://my.wconvert.io/api/v1/wconvert/entitlements/keys` |
| `NEXUS_ISSUER` | `https://nexus.veronalabs.com` |
| `NEXUS_AUDIENCE` | `https://templates.wconvert.io` |
| `NEXUS_ENVIRONMENT` | `production` |

`templates:download` is already enforced in the Worker, together with store
`wconvert` and item `wconvert-pro`. There is no collection variable to add.
Grant and public-key URLs must share an API origin; the signed issuer is checked
separately and must match exactly. The service key must be authorized for this
collection in Nexus.

After deployment, run `npm run verify:remote -- --expected RELEASE_ID --premium configured`
from this directory. This checks public files and anonymous premium refusals; it
does **not** prove that Nexus accepts the service key or that a licensed download
works. Complete the real licence tests described above before claiming that.
Without the secret, use the default verification mode (expected premium 503).


### Website gallery configuration

Deploy the gallery-capable Worker before publishing the new release. Its
`PREVIEW_EMBED_ORIGINS` setting is:

```text
https://wconvert.io https://www.wconvert.io https://dev.wconvert-website.pages.dev
```

Use those exact origins without paths or trailing slashes. The development address
is the approved Pages branch URL; other branches and localhost remain blocked.
Keep the existing R2, rate-limit and Nexus bindings/secrets when deploying.
The integrated plan preserves all eight live packs. Do not publish the old six-pack
rehearsal. Remote publication blocks missing packs before uploads; an intentional
removal or rollback needs one `--remove-pack ID` per removed pack as well as the
normal `--expected` current-release check. Merely merging Git changes does not
change the hosted Worker or catalogue.

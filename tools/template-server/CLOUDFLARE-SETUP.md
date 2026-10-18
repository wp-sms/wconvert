# Set up WConvert Template Library

We will start with **one hosted environment**, using its intended final name.
WConvert is prelaunch, so this environment can be tested before customers depend
on it. Local development remains isolated in Wrangler's on-disk emulator. A
separate staging environment can be added later when changes need testing without
affecting a live customer service. Nothing below has been provisioned yet.

## Names to use

| Purpose | Name |
| --- | --- |
| Service | WConvert Template Library |
| Cloudflare Worker | `wconvert-template-api` |
| Free files and public previews bucket | `wconvert-templates-public` |
| Premium files and temporary passes bucket | `wconvert-templates-private` |
| Suggested final HTTPS address | `templates.wconvert.io` (confirm domain ownership first) |

“Public” describes what the Worker may serve anonymously. **Both buckets stay
private**: disable Public Development URL/r2.dev and do not attach bucket custom
domains. Only the Worker serves files. Free downloads and previews need no licence;
premium source files require Nexus authorization.

## What to prepare later

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
   uses bindings; no R2 S3 key belongs in the Worker or plugin. Future publishing
   credentials belong to the operator and must be scoped to these buckets.

The useful non-secret details to share are: Cloudflare account ID, final Worker
address, bucket names, Nexus URLs, issuer, environment and audience. Install the
service key locally when ready.

## Configuration and deployment checklist

The default Wrangler configuration is the single hosted environment. **Do not use
`--env staging`**; no such environment is configured. Local `wrangler dev`, tests
and dry-run builds use emulated storage and do not upload files.

When the infrastructure and credentials are ready:

- Authenticate Wrangler locally to the chosen account.
- Fill `NEXUS_GRANT_URL`, `NEXUS_KEYS_URL`, `NEXUS_ISSUER`, `NEXUS_AUDIENCE`, and
  `NEXUS_ENVIRONMENT` in `wrangler.jsonc`. Add the confirmed Worker custom domain
  and account configuration. Keep `workers_dev` and preview URLs disabled.
- Run `wrangler secret put NEXUS_SERVICE_KEY` from `tools/template-server`.
  These are future operator instructions, not commands to run during local setup.
- Require HTTPS and configure request limits for `/grants` and private file
  requests before exposing the service. Nexus separately limits issuance.
  Redact Authorization/X-License-Key, request bodies and passes in infrastructure
  logs. Never add credentials to URLs.
- Implement the authenticated remote publisher using the existing validated local
  publication logic. Upload and verify private/public dependencies first, then
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

## What is still local

No buckets, Worker deployment, DNS records, real Nexus connection, default plugin
catalogue URL, remote publisher or live entitlement acceptance has been created.
Local tests run the actual Worker/WebCrypto/R2 runtime with a test Nexus responder;
native WordPress tests separately intercept HTTP. These checks do not claim that
the live WordPress → HTTPS Worker → Nexus route has been exercised.

References: [Create R2 buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/),
[Worker bindings](https://developers.cloudflare.com/r2/api/workers/workers-api-usage/),
[Object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/),
[Worker custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/),
[Nexus handoff](https://github.com/veronalabs/nexus/issues/1246#issuecomment-6233517224).

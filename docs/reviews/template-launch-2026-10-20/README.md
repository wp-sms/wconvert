# Template service launch operations — 20 October 2026

## Legal publication

Published production website commit `49e83e4` to `wp-sms/wconvert-website` main.
Both live pages were fetched and confirmed to contain the service additions and
20 October update date:

- <https://wconvert.io/privacy/>: explicit template connection, public versus
  premium data, Nexus authorization, temporary grants, Cloudflare and rights.
- <https://wconvert.io/terms/>: template service, licence eligibility, downloaded
  use, limits and availability.

Operator remains VeronaLabs OÜ; contact remains hi@veronalabs.com. The plugin
readme and native catalogue disclosure now link these pages and correctly
distinguish Free requests from premium licence/site authorization. Plugin edits
are in this checkout; production website publication does not distribute a new
plugin package.

The isolated website production build and checks passed. The same legal patch
was applied to the existing website development checkout without reverting its
unrelated changes; its build and checks also passed.

## Storage and recovery

Read-only live snapshot:
`/Users/navidkashani/.local/share/wconvert/backups/template-library-2026-10-20`.
Captured at `2026-10-20T05:11:15.130Z`: 1,412,015 bytes, 23 public objects,
three private objects, three retained releases. Backup files are 0600,
directories 0700 and outside the WordPress document root.

The fresh local Workerd/R2 rehearsal restored every object, checked private byte
identity and isolation, verified four Free packs/16 setups, six public previews,
one Free image and two premium refusals. It rolled back both older releases and
restored the current release:
`7a6c87a5c2b8d70a9e068420dd9b003a0e5f586344e707a874de0c321c687c59`.
See [machine-readable evidence](recovery.json). Production writes: zero.

This is a local catalogue recovery rehearsal. No offsite backup schedule, live
account failover, Nexus database restore, secret recovery or new licensed HTTP
acceptance is claimed. Temporary grants/licences/passes/secrets are excluded
from the snapshot.

## Dashboard inspection

The supplied zone dashboard shows Free and one WAF rate-rule slot. No plan
upgrade or zone-wide WAF rule was made. Separate Worker rate limiter bindings
were configured via Chrome:

| Binding | Namespace | Limit | Period |
| --- | --- | --- | --- |
| GRANT_RATE_LIMITER | 202610201 | 30 | 60 seconds |
| DOWNLOAD_RATE_LIMITER | 202610202 | 300 | 60 seconds |

They count Cloudflare connecting IPs separately. Download JSON and premium
images share a counter, including GET, HEAD and conditional retries. Counters
are approximate per Cloudflare location, not a global usage quota. Missing or
failed limiters fail closed for premium routes; public reads remain independent.

Both buckets' public access is disabled. Private bucket custom domains are
absent. The enabled `cleanup-download-grants` lifecycle rule deletes `grants/`
objects after one day. The deployment API confirmed both Worker `workers.dev`
and preview URLs disabled. Existing Nexus secret and configuration were preserved.
Worker version `cd421d7d-aae9-4073-8d54-645691706de8` was deployed to 100% at
`2026-10-20T05:35:22.932755Z`; its API metadata confirms both correct limiter
bindings, R2 bucket bindings and the existing Nexus secret. Code fetched back
from Cloudflare contains the rate limiter calls and fail-closed response.

The initial short HTTP/1 probes did not observe 429s; a subsequent HTTP/2
connection did. Keep the failed [initial probe](rate-limits-initial-probe.json)
as evidence of the limits' eventual consistency. The verification script now
holds one HTTP/2 connection to make its bounded test repeatable. This does not
make the production limit a strict global quota.

The final [bounded burst](rate-limits-burst.json) passed at 05:42 UTC from ARN:
40 grant requests produced seven 429s; 310 private-file requests produced nine
429s. Actual admitted counts exceeded nominal limits slightly, consistent with
the provider's approximate counters. Premium-image HEAD also returned 429.
All blocked responses supplied `Retry-After: 60` and `private, no-store`.
The private route still returned its normal anonymous 401 while the grant
counter was exhausted, proving the scopes were separate. Public manifest access
remained 200 throughout. No valid licences or passes were submitted to Nexus.

[Cooldown recovery](rate-limits-recovery.json) passed at 05:43:47 UTC: malformed
grants again returned 400, unauthenticated files/images returned 401, and the
public manifest returned 200. A subsequent [full live catalogue check](live-service.json)
passed for the unchanged published release, including all four Free packs,
six public previews, one Free image, 16 downloaded setups and two premium
refusals. This completes the requested legal publication, live request-limit
verification and local backup recovery rehearsal.

## Validation

- Worker type check and 45 service tests passed; see [test output](service-tests.txt).
- Plugin template picker: 19 tests passed; TypeScript and Free/Pro builds passed.
- Website production and development builds/checks passed.
- Backup restore rehearsal passed with the production rate binding settings.

Whole-licence expiry/revocation with dedicated disposable licences remains
separate acceptance work recorded in the Cloudflare setup guide.

## How the plugin uses the service

The picker is the plugin's own React interface. An explicit “Check for packs”
asks the WordPress backend to fetch manifest/catalogue JSON. Preview/install
fetch validated template JSON and approved image bytes. WordPress verifies
hashes, sizes and types, then stores installed definitions and images locally.
The plugin's bundled renderer builds both admin previews and visitor campaigns.

Premium preview/install additionally asks the trusted service to authorize the
licence and activated site through Nexus, then uses a short-lived pass. Free
requests send no licence. No campaigns, leads or form responses go to the
template service. Installed campaigns keep working without the service.

The “View public previews” link opens a separate hosted demo tab. The normal
picker does not embed that hosted page or load executable remote plugin code.

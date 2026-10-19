# Nexus custom-host connection — 19 October 2026

Prepared on `codex/nexus-worker-connection`. The operator confirmed dashboard
deployment on 19 October; subsequent live verification results are recorded below.
Cloudflare CLI authentication remains unavailable.

The grant and key endpoints now use the supplied `my.wconvert.io` host, while
signature verification continues to pin issuer `https://nexus.veronalabs.com`,
audience `https://templates.wconvert.io` and environment `production` (Nexus handoff).
API endpoints must share an HTTPS origin; redirects and unsafe URLs are refused.
No real service key was added to source, build output or tests.

Validation performed:

- `npm --prefix tools/template-server run check`: passed.
- `npm --prefix tools/template-server test`: 40 tests passed. New checks cover
  custom API hosts, issuer substitution, redirects, unsafe endpoint configuration,
  and explicit configured/unconfigured anonymous-download verification.
- `npm --prefix tools/template-server run test:wordpress`: WordPress 7.1.3 / PHP
  8.1.34 passed Pro wiring, server-only credentials, pack/image installation,
  damaged-image refusal, expiry and offline preview. Nexus HTTP is a fixture here.
- Live remote verification passed for release
  `b956f0d012399019d72341b4752cfd24e3fa6b7484f4d85f26e0c5c4ee9a7858`:
  four Free packs, sixteen setups, five public previews, one image; premium remains
  unconfigured (503). This checks the existing deployed Worker, not the new build.
- The supplied public-key endpoint returned HTTP 200 and one public Ed25519
  signing key. No service credential was sent.
- `git diff --check`: passed.

The dashboard artifact is generated from the tested dry-run build at
`~/.local/share/wconvert/template-library-deploy/worker.js` with its source-map
reference removed. Keep existing R2 bindings and compatibility date 2026-10-01.

## After operator deployment

- Remote verifier with `--premium configured`: passed for the same release;
  four Free packs, sixteen setups, five public previews and one image. Anonymous
  premium downloads now return 401 rather than unconfigured 503.
- Disposable WordPress against real HTTPS: all four Free packs installed;
  thirteen designs, sixteen setups, one verified image. Offline recovery passed.
  WordPress 7.1.3 / PHP 8.1.34; no persistent site settings or campaigns changed.
- A deliberately invalid customer licence sent to the Worker for a real premium
  pack returned Nexus's `401 invalid_key`. In this code path the Worker loads and
  verifies the private pack before calling Nexus; service-authentication errors
  would instead become 503. This exercises live issuance refusal, not success.
- Missing licence: 401 invalid_key. Forged pass, anonymous premium HEAD and
  anonymous premium image: 401 invalid_grant (HEAD has no body). Malformed request
  and client-provided resource list: 400 invalid_request. All seven responses
  carried `Cache-Control: private, no-store`.
- Live public keys: HTTP 200, one public Ed25519 signing key.

Subsequent licensed acceptance is recorded below. Dashboard variables, exact
secret value, lifecycle and edge rules cannot be audited via public probes.
The branch remains unmerged.

## Real test licence acceptance — 19 October 2026

The operator supplied a test licence and authorized setting up a test site.
The licence value and raw signed passes are omitted from this record and Git.

- `wconvert-template-test.local` initially received 403 `domain_not_allowed`.
- Activated only that disposable site using the existing Nexus activation API:
  HTTP 200. The actual user’s local site was not changed.
- Worker issuance returned HTTP 200 with a 300-second pass. Issuer, audience,
  environment and site matched the configured connection.
- Downloaded the actual premium `shopping-help` pack and verified its SHA-256:
  six designs and six setups. Authorized HEAD returned 200; attempting a
  different pack with the same pass returned 403.
- An unactivated reserved test domain returned 403 `domain_not_allowed`.
- Disposable WordPress 7.1.3 / PHP 8.1.34 first correctly refused installation
  because this pack requires WooCommerce. With the real locally installed
  WooCommerce plugin loaded, the real Pro transport installed all six designs
  and six setups via live HTTPS. No successful HTTP response was mocked.
- Checked the SDK’s normalized site identity, licence placement only on grant
  requests, Bearer pass on file requests, no licence in admin preview/status,
  and installed preview availability with networking disabled.
- Removed the temporary Nexus activation after testing: HTTP 200. Fresh grant
  issuance for the removed site then returned 403 `domain_not_allowed`.

- Waited for the real 300-second pass to expire naturally. A subsequent premium
  download returned HTTP 401 `invalid_grant`.

The current premium pack contains zero image assets, so real premium image
issuance/download is not claimed by this run. Local fixtures cover that path;
real Free image delivery was checked separately. Whole-licence expiry/revocation
was not induced, and no other site activation was changed.


## Pre-merge review — 19 October 2026

Separate standards and requirements reviewers found stale setup and ADR status
statements, now corrected inline. The hosted verifier instructions now explicitly
use `--premium configured`, and the dashboard guide explains rebuilding its
bundle from the checkout. Both reviewers confirmed no outstanding findings after
those corrections. No runtime change was needed during this review.

The Worker type check/build and all 40 server tests passed again. Configured-mode
live verification passed again for the published release (four Free packs,
five previews, sixteen setups, one image, anonymous premium refusal). Prior real
licensed WordPress and natural-expiry evidence above applies to the unchanged
Worker code. CI is skipped by explicit operator instruction.

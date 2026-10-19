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

Still required: a real authorized test licence and its activated site to verify
successful signed issuance, premium pack/image installation and expiry. Actual
expired/revoked/inactive-site licence cases also remain untested live; local
fixtures cover these failure branches. Dashboard variables, exact secret value,
lifecycle and edge rules cannot be audited via these public probes. No real
licensed end-to-end success is claimed. The branch remains unmerged.

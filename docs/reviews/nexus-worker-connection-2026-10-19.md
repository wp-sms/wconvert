# Nexus custom-host connection — 19 October 2026

Prepared on `codex/nexus-worker-connection`. Dashboard deployment is pending;
Cloudflare CLI authentication is unavailable and the operator chose dashboard steps.

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

Still required: deploy this code, set variables and the Worker secret, rerun remote
verification with `--premium configured`, and perform real licensed acceptance
using an authorized test licence and activated site. No real service-key validity
or licensed end-to-end success is claimed by these checks.

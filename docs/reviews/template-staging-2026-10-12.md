# Local template staging rehearsal — 12 October 2026

The public Worker runs on loopback port 9454 with a locally simulated R2 binding. No Cloudflare account, bucket, deployment, licence credentials, private binding or plugin setting was configured.

Loaded the previously validated release `7c71c0d5fa2254a8fda0dd9c8e95ad3f2fdec878f5c46263ac79aee17a5aa736`: 15 immutable public objects, four Free packs containing 16 setups, five public preview pages, one Free image. The catalogue additionally advertises one premium pack with six setups; its download returns a non-cacheable 503 until licence integration exists. Its public preview works normally.

An identical seed repeated against the current release created zero objects and reused all 15. The HTTP verifier checked catalogue-page hashes, pack hashes, preview hashes and image hashes. Every preview option was exercised in Chromium through the Worker's CSP: 34 screens/results across all five pages, desktop/mobile controls, no JavaScript errors. The HTML sandbox deliberately prevents external requests and form submission; this is an inert showcase.

Nine Node subtests execute the actual bundled Worker and R2 simulation in workerd. They cover: empty storage; first publication and idempotent reuse; GET/HEAD/ETag/304/cache policy; explicit route/method/query refusals; premium refusal even with a claimed token/tier; preview/image MIME and bounds; an interrupted write preserving the prior entry point; competing publishers with one winner; rollback and immutable reuse; corrupt or premium local public input rejection. Root template/export tests continue to validate the publisher's schema, tier, image-rights and immutable-version rules separately.

Worker type generation/typecheck and local dry-run bundle pass. Root validation after design changes: 2,819 PHP tests, 4,255 JavaScript tests, 38 studio/export tests, TypeScript and template registration passed. CI was intentionally skipped per user instruction.

Limitations: metadata uses the reserved HTTPS `templates.example` origin; the loopback server mirrors only its paths. The production plugin still requires HTTPS, and no HTTP exception was added. This run does not claim a live HTTPS staging-to-plugin install. A real deployment still needs R2/account/domain choices, authenticated operator publishing, distributed storage/cache/outage and backup checks, and the real licence-manager adapter before enabling private downloads. The current Worker intentionally has no remote upload route and no private storage capability.

Operations and commands: [template-server README](../../tools/template-server/README.md). No local templates or saved campaigns are rewritten when switching the remote catalogue pointer.

Independent standards and requirements reviews found one local-tooling defect: URL path escaping broke the seed command in a checkout containing spaces. It now uses `fileURLToPath`; the actual 15-object release seeded successfully from a temporary path containing spaces. No other blocking finding remained. Final ESLint, source-contract and 107-design registration checks passed.

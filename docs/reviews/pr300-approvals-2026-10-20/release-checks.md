# Final local release checks

The final source was exported to an isolated temporary checkout from HEAD plus only this PR's approval/evidence/tooling changes. Unrelated local template-server and admin edits were excluded. Dependencies were reused; generated assets were rebuilt with Node 22.

- Production assets build: passed.
- Collection release gate: six of six current approvals; passed.
- Considered-essentials gate: six of six current approvals; passed.
- Screenshot proof ledger: six setups, 72 required captures; passed.
- Review-scope/proof tests: nine passed, including phone-source invalidation.
- Free ZIP: wconvert-v1.0.0.zip, artifact contract passed.
- Pro ZIP: wconvert-pro-v0.1.0.zip, artifact contract passed. This is one Pro artifact for all licence site limits.
- Post-generation WordPress discovery: five Free collections, six Pro collections, current generated revisions, campaigns unchanged. See discovery-published-free.json and discovery-published-pro.json.

Full-suite results are recorded below. CI, merge and hosted publication are deliberately not performed. Existing backlog remains 101 stale setup reviews and 39 older unrecorded design-version changes; the global library gate is not claimed to pass.

PHP suite: 3,382 tests / 19,274 assertions passed. The isolated checkout initially lacked generated Composer packages; copying the existing scoped dependencies resolved its bootstrap error. The first isolated JavaScript run used a symlinked node_modules; Vite rejected CSS imports outside that checkout. Dependencies were copied locally and the suite rerun. These were test-environment setup errors, not ignored test failures.

Final isolated JavaScript rerun: 255 files / 4,482 tests passed. Earlier typecheck and source-contract checks also passed. All required local release checks are complete; CI was skipped at the user’s request.

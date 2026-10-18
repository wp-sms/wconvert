# Publication and release verification — 18 October 2026

- Imported 24 setup decisions through `npm run templates:review`, rebuilt the pilot, then imported all six collection decisions. The first collection export used the pilot generated before the setup import and was correctly rejected as stale; rebuilding the pilot and collection metadata resolved that export conflict. No review validation was bypassed.
- `npm run templates:collections:publish` and `npm run templates:collections:check` passed: six current approved collections. The six generated bundled JSON files changed only their review-bound revision.
- Fresh post-publication discovery passed for all six collections. Five collections are usable in the Free context; Pro can discover all six. Event boundaries and prepared previews passed. Native WordPress returned all six and existing campaigns remained unchanged. See [published/discovery.json](published/discovery.json).
- `bash bin/build.sh all` completed with both artifact contracts passing: `dist/wconvert-v1.0.0.zip` and `dist/wconvert-pro-v0.1.0.zip`. Pro is one ZIP across site-count plans under ADR 0146.
- `composer verify:source` and `git diff --check` passed.
- The plugin/Worker test results and local premium download acceptance are recorded in [the API review](../nexus-template-downloads-2026-10-18.md).

The resulting review status is 24 approved setups, 104 stale setups outside these collections, and six approved collections. This does not approve the entire studio library. Nothing was merged, deployed, uploaded to Cloudflare or sent to an external recipient. CI was not used.

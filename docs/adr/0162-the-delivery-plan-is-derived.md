# 0162: The delivery plan is derived, and checked before merge

Accepted 2026-10-21. Amends 0156.

Publishing the Halloween designs (PR #318) failed late for a reason no check
on the pull request saw, and needed two hand edits that nothing enforced.

## 1. A stale approval cannot reach `main`

A setup's revision includes a hash of the whole shared stylesheet
(`build/rendered-identity.mjs`), so any edit to it stales every approval, even
one that draws nothing differently. That stays: pixels are the real test, and
jsdom cannot say which campaigns a rule reaches. What changes is when it is
noticed.

`npm run templates:releasable` builds the pilot and fails when any setup's
latest decision was an approval that is no longer current, or when the runtime
Collections are out of step with their reviews. Its message is the fix:
`npm run templates:visual-diff -- --apply`, whose `--base` now defaults to where
the branch left `origin/main`. That carries every pixel-identical setup and
Collection and lists the rest. A setup never approved, or sent back, does not
fail it. CI runs it in the Template service job, whose path filter now covers
everything a revision is computed from: the renderer, playbooks, Pro modules'
designs and playbooks, and `src/Template`.

# 0162: The delivery plan is derived, and checked before merge

Accepted 2026-10-21. Amends 0156 and 0157.

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

## 2. What is online is derived, not listed

`publishing/catalog.json` listed the setups to publish, the setups to show
bundled-only (each with a hand-copied reason) and the Collections. Every
approved setup was on exactly one of those lists, so they recorded nothing a
review had not already decided, and forgetting an entry kept a design off the
website with no error. That is how the Halloween designs missed it.

`build/delivery.mjs` derives all three, and the release and the studio's
online/held panel both call it:

- **Published**: every setup whose review is a current approval and which
  exports, with its design.
- **Bundled-only**: every current approval that does not export, with the
  exporter's own reason (`Design <id>: <reason>`).
- **Collections**: every Collection whose review is current. One never
  approved is a draft that ships nowhere and blocks nothing; one already in
  `resources/collections/` that has lost its approval is still refused.

`templates:revisions` now exports and numbers every authored setup, not a
planned subset; one that cannot export is a held result rather than an error,
and a setup removed from the repository is retired as before. A hosted design
that cannot export is still an error (0157).

A stale approval refuses the release outright rather than dropping a live
setup from the website, with the same command as §1. `withdrawn` still wins: a
setup or design it names without a revision is never derived back in.

`catalog.json` keeps what is editorial or about rights: `designs` (published
with no setup), `withdrawn`, `image_rights` and `artwork_exports`. It is
schema 3; both readers refuse 2.

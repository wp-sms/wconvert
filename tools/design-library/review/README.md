# Shared editorial reviews

The internal studio reads the shared review store in `records/`: **one JSON file
per decision**, named by its digest (ADR 0156). Reviewers share those files and
their evidence through the normal Git branch/PR workflow; this is not a hosted
multi-user service. The studio shows the decisions; it does not record them.

Each record names the decision it was made over (`base_id`), so a campaign's
records form one chain. Two branches that both decide over the same earlier
review merge in Git without a conflict and are then **refused on read**, naming
both records: rebuild, read both and record one decision over the later. A
record whose bytes no longer match its name is refused the same way.

1. Build with `npm run templates:pilot`. After a renderer or shared-CSS change,
   run `npm run templates:visual-diff -- --base origin/main --apply` first.
2. Run the machine checks and capture the contact sheets, then judge what only a
   person can: [the workflow](../MAINTENANCE.md#reusable-batch-verification),
   [what is judged](../pilot/PRACTICAL-REVIEW.md).
3. Write one `docs/reviews/<batch>/review.md` with a line per setup on what is
   specific to it. Do not restate the standing limits below.
4. Write the export (`{"schema": 2, "reviews": [...]}`, one entry per setup,
   `base_id` its latest record). Agents and commands record decisions; the
   studio only shows them, with their notes and evidence.
   `journey` and `wordpress` cite `results.json`; `visual` cites the setup's two
   contact sheets and `review.md`. All three must pass for **approved**.
5. Import and gate:

   ```bash
   npm run templates:review -- '/path/to/export.json'
   npm run templates:gate -- coverage
   ```

   Import rebuilds the campaigns before validation; the gate exits nonzero for
   missing, stale or revision-requested approvals.
6. Commit the evidence and the new record files together.

**Standing limits of every review**, said once here rather than in each report:
an approval does not assert external email or SMS delivery, physical-device
behaviour, a translation review, measured conversion, or release approval.
Machine checks run on a disposable local WordPress with local capture and a
local mail outbox.

A decision is bound to what ships: the rendered screens and the shipped
configuration (`build/revision.mjs`). The planning brief, the batch, similarity
neighbours and fingerprints are excluded, so editing a brief or growing the
library does not invalidate an unchanged setup. Evidence is hashed when it is
imported; a missing file stales the decision, an edited one does not (Git shows
the edit). Import
validates the complete export before writing, adds one new file per decision and
never rewrites an existing one, rejects stale exports and conflicts, and is
idempotent for an identical export. Concurrent local imports are serialized. A
process crash can leave `records.lock`; remove that empty directory only after
checking no import process remains.

On a conflict, rebuild, read the current shared decision in the studio, and
write the new decision over the later record.
Reviewer names are editorial attribution, not authenticated identities or signed
approvals. Git review is the sharing and accountability boundary.

The existing 48 approvals were reconciled from recorded evidence with matching
campaign revisions. First-batch practical evidence and later native WordPress
evidence are explicitly identified; importing them is not a claim of a new
visual inspection. Editorial approval never asserts external delivery, measured
conversion improvement, physical-device verification or release approval.
External email/SMS delivery is skipped at the user's request for this work.

`pilot/next-batch.json` is empty after the contextual-help batch. The collection
contains 132 actual setups, with separate campaign and design counts. Add planned
briefs only after choosing distinct visitor needs; the validator rejects IDs
already in the collection.

See [maintenance](../MAINTENANCE.md) for dependency inspection, design version
notes, retirement metadata and the separate checks required for runtime changes.

# Shared editorial reviews

The internal studio now reads `shared-reviews.json`. Reviewers share this file
and its evidence through the normal Git branch/PR workflow; this is not a hosted
multi-user service. Browser edits are drafts until imported and committed.

1. Build with `npm run templates:pilot` and inspect the prepared campaign.
2. Complete the comparison in the brief and the [practical review](../pilot/PRACTICAL-REVIEW.md).
   Check every screen and result, including failure/retry and acknowledgements.
3. Save the supporting report under `docs/reviews/`. State what was observed,
   simulated, tested through native WordPress and left untested. Keep test details
   fictional. Do not include credentials or real customer data.
4. In **Review decision**, enter a reviewer name and notes. Expand **Checks and
   evidence**. Record visual, visitor-route and configured WordPress results, with
   one repository-relative evidence path per line. All three must pass for
   **Editorially reviewed**. A single report may support several checks.
5. Export review, then import:

   ```bash
   npm run templates:review -- '/path/to/wconvert-pilot-review.json'
   npm run templates:gate -- coverage
   ```

   Import rebuilds the actual campaigns before validation. The gate rebuilds again
   and exits nonzero for missing, stale or revision-requested approvals. Omit
   `coverage` to check every campaign. This workflow runs locally, without CI.
6. Commit the evidence and shared review records together. Rebuild the studio on
   another checkout to see the decisions.

Campaign and renderer revisions bind decisions to the reviewed output. Evidence
content is hashed too: a changed or missing file invalidates the approval. Import
validates the complete export before atomically replacing the store, keeps prior
records, rejects stale exports and conflicts, and is idempotent for an identical
export. Concurrent local imports are serialized. A process crash can leave
`shared-reviews.json.lock`; remove that empty directory only after checking no
import process remains.

On a conflict, rebuild, read the current shared decision, and use **Use shared
version** to discard the outdated local draft before making a new decision.
Reviewer names are editorial attribution, not authenticated identities or signed
approvals. Git review is the sharing and accountability boundary.

The existing 48 approvals were reconciled from recorded evidence with matching
campaign revisions. First-batch practical evidence and later native WordPress
evidence are explicitly identified; importing them is not a claim of a new
visual inspection. Editorial approval never asserts external delivery, measured
conversion improvement, physical-device verification or release approval.
External email/SMS delivery is skipped at the user's request for this work.

`pilot/next-batch.json` is empty after the contextual-help batch. The collection
contains 96 actual setups, with separate campaign and design counts. Add planned
briefs only after choosing distinct visitor needs; the validator rejects IDs
already in the collection.

See [maintenance](../MAINTENANCE.md) for dependency inspection, design version
notes, retirement metadata and the separate checks required for runtime changes.

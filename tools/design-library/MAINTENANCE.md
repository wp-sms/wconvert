# Maintaining the campaign library

A **design** owns layout, tokens and reusable screens. A **Playbook** combines a
Goal, a design, suggested copy and display rules. An internal **brief** explains
the visitor need, differences, prerequisites and measurement. A saved customer
Campaign owns its own prepared copy of the design, settings and content.

One design may serve several useful setups. Count those setups separately from
visually distinct designs. A different colour or industry name alone does not
justify a new design. Compare existing structures before authoring another one.

## Change a design

Before reviewing a batch, run `npm run templates:review:scope -- origin/main`
(or pass the commit the work started from). The report in `out/review-scope.json`
lists changed designs, **every registered dependent setup**, every screen/result
and affected collections. It separates the unrelated stale-review backlog from
this change. Dependents outside the curated studio still need a brief and review.
Shared renderer, loader, PHP runtime, vocabulary or sample-artwork changes request a whole-library
review. The planner never changes approval hashes or clears stale decisions.

`npm run templates:gate -- <batch>` enforces current approvals and recorded design
versions for that batch. It reports unrelated maintenance debt without blocking
the named batch. `npm run templates:gate` without a batch still enforces the
entire library. A batch pass is not permission to release a shared runtime change
without the wider review identified by the scope report.

Keep source fixes local to the design where possible. This preserves unrelated
reviews; it does not exempt a shared rendering fix from broader verification.
Finish layout/copy edits before capturing final evidence. Any later edit requires
fresh evidence for its affected setups. Do not repeatedly approve a moving target.

1. Build with `npm run templates:pilot`. In **Design maintenance and update impact**,
   choose the design. The dependency list includes every registered Playbook,
   including starts outside the curated collection. Curated entries open directly.
2. Make the source change. Keep stable leaf IDs and submission references.
3. Record the reason:

   ```sh
   npm run templates:record -- slide-in-question "Improve spacing around the topic choice"
   npm run templates:pilot
   ```

   This appends a numbered source hash and dated note in
   `review/design-history.json`. An unchanged design cannot receive another version.
   Recording a version is neither editorial approval nor publication.
4. Review all affected setups, every screen and branch, using the actual prepared
   content. The collection's existing decisions become stale when their prepared
   output changes. Also inspect registered dependents outside the collection before
   shipping; they do not automatically gain an approval from this gate.
5. Import revision-bound visual, journey and WordPress evidence, run
   `npm run templates:gate`, and submit the normal PR. The gate fails for an
   unrecorded design change, missing approval, stale output or changed evidence.

### Reusable batch verification

Build `node tools/design-library/build/batch-audit.mjs <batch>` after the pilot.
Its single page shows every prepared screen at 320, 390, 768 and 1440px, with
long-copy and RTL controls. Inspect the pictures; measurement results alone do
not assess hierarchy, relevance or composition. The consent stress control uses
sample text only when a normally hidden consent leaf has no prepared wording.

For real capture, mount `tools/visual-tests/mu/harness.php` and
`tools/visual-tests/mu/template-batch.php` in a **disposable localhost WordPress**.
Open `/?wconvert_template_batch=<setup>&batch=<batch>`. This fixture reads the
studio's batch allowlist, uses real Prefill and local capture, disables other
fixture campaigns and replaces its previous campaign. It never belongs on a
customer site. The harness prevents outbound mail. It opens shadow roots solely
for inspection. Check desktop, phone, transition widths, scrolling, dismissal,
required/invalid input and saved values. Test failure/retry in the studio as well.

Before saving each native screenshot, assert the actual page viewport width and
wait for the expected screen content. For asynchronous products, wait for a
loaded product action, not merely the page heading or an empty renderer root.
Recheck the viewport after switching tabs: browser-wide overrides may apply to
the newest tab. A filename containing `320` is not evidence of a phone viewport.
Inspect the saved image before adding it to the approval ledger.

Save the final screenshots in a new `docs/reviews/<batch-date>/` directory. Keep
a `proof.json` ledger with each setup's current `revision`, a written `judgement`
and `captures` (`screen`, nullable `result`, `surface`, `width`, `path`, `sha256`).
An all-screen sheet may cover multiple screen records. Use `studio` for all four
widths and `wordpress` for 320 and 1280px. The considered-essentials evidence is a
complete example. Before importing a review, run:

```sh
npm run templates:review:proof -- docs/reviews/<batch-date>/proof.json
```

It rejects missing screens/results/widths, incomplete batches, stale revisions,
missing pictures and changed screenshot bytes. It **does not approve designs**
or establish that someone looked at a screenshot. The visual judgement, actual
journey checks and native WordPress evidence remain reviewer responsibilities.
Import the ledger as supporting evidence with the written review. Keep provider
delivery and physical-device testing explicitly separate.

Changing only Playbook copy requires new campaign review evidence, not a design
version. Renderer and container changes require wider regression checks, including
real WordPress placement. The snapshot review hash covers the studio renderer;
it does not replace testing the shipping overlay containers.

The initial version is a baseline recorded on 28 September 2026, not a claim about
the design's original publication date. History is an internal editorial record,
not a merchant-facing update service or a downloadable catalog version.

## Editorial prompts and visual checks

The studio points out empty copy, icons without companion copy, and benefit rows
that may wrap unevenly. Site-owned wordmarks are deliberately cleared by Prefill
and are excluded from empty-copy prompts. Prompts are advisory: inspect the actual
output before deciding. A meaningful acknowledgement checkmark is allowed.

Review hierarchy, typography, spacing, icon purpose, long labels, desktop and
320px layouts, RTL, every acknowledgement and every result. Run local layout
checks, then test required fields, failure/retry, dismissal and real configured
links. Resource emails must point to useful content. A request must not claim a
booking, purchase or completed delivery. Provider delivery remains separate.

## Retire a design

Keep its source and history for traceability. In `review/design-history.json`, set
`status` to `retired`, add a plain-language `reason`, and identify an active design
with `replacement`. The build rejects unknown replacements, self-replacement and
replacement chains/cycles. The internal studio hides retired designs' setups from
normal discovery but keeps the maintenance record and dependents visible.

This metadata is **internal only**. It does not remove installed templates, rewrite
Playbooks, change the customer picker or publish/remove a downloadable pack.
Changing customer availability needs a separate reviewed packaging change. No
current design is retired by this batch.

## What happens to customer campaigns?

| Change | Existing saved campaign | Future campaign |
| --- | --- | --- |
| Update bundled design/copy | Keeps its saved tree and wording | Starts with the new version |
| Retire a design internally | Unchanged | Internal authors are directed to the replacement; shipping availability is separate |
| Fix renderer/container behaviour | May receive the behaviour fix when the plugin updates | Receives the same fix |
| Merchant chooses another design | Explicit draft edit, with existing editor undo/review | Uses the chosen design |

Never silently overwrite a merchant's edits. Any future “update available” feature
must preview the change, preserve custom content, create a recoverable draft and
require explicit application. That feature is not implemented here.

Work in batches: identify a useful uncovered need, compare, author, inspect, test,
record evidence, then expand. The working library currently contains 132 setups
using 76 source designs; the full design inventory contains 108 designs. Do not count
planned briefs, colour variants or unreviewed candidates as additional designs.

## Browse designs without duplicate cards

The studio groups filtered setups by design. Its use-case control changes the
prepared preview, goal, requirements and review target together. The customer
creation picker groups by design and effective format after filtering by goal,
business, search and collection; selecting a use case keeps that exact Playbook
for setup details and draft creation. A filter never hides a matching use case
behind a nonmatching default. Browsing and switching use cases save nothing.

The first four new directions and the next eight visual-variety designs are
implemented. The next eight briefs are separate planned work: six composition
candidates and two deliberate reuses. Palette or
copy changes do not qualify as a new design. Current design counts refer to
source designs, not independently proven conversion performance.

## Visual audit before expansion

Open `out/roadmap.html` after the pilot build. The 29 September audit retains
70 compositions, identifies 15 improvement tasks and marks 6 candidates for
comparison before consolidation. Its source is `review/visual-audit.json`.
These are advisory priorities, not retired status, campaign approvals or changes
to customer availability. Resolve priority-one improvements before registering
the next expansion batch.

Each record identifies the source revision and the whole audit identifies the
renderer revision. A change makes its recommendation stale. Inspect the new
output and save fresh evidence before updating those revisions; never update
hashes just to remove a warning. New designs remain unreviewed in this board.

Before consolidation, inspect every registered dependent, preserve the useful
fields and Slot Roles, check Keep my content/Sample copy transfer, and review
Free/paid packaging. Saved merchant snapshots must stay untouched. A high
structural similarity score is a comparison prompt, not an automatic deletion.
The next-batch sketches are not working templates and never enter design counts.

## Finish review before calling a release ready

After a shared renderer or prepared-campaign change, rebuild the review queue.
A renderer change can invalidate every setup approval, even when most designs
look unchanged. A setup approval change also changes its dependent collection
revision. Old visual evidence is not a substitute for inspecting the new output.

For a release containing the bundled collections:

1. Review the current members listed in `collections/source.json`: all screens,
   phone/desktop, long copy/RTL, practical journeys and configured WordPress.
   Fix defects or leave a revise decision; never change hashes to bypass review.
2. Save fresh evidence, import setup decisions through `templates:review`, then
   rebuild with `templates:collections`. Review and import collection decisions.
3. Run `templates:collections:publish`, then `templates:collections:check`.
   Check the actual WordPress picker reads the regenerated collections.
4. Build current assets, run required tests and `bash bin/build.sh all`. Confirm
   the Free and Pro ZIPs (the single Pro artifact in ADR 0146), and update the current approval counts.

This is a local release checklist, not a CI requirement. State any out-of-scope
stale reviews explicitly; passing the bundled-collection gate does not approve
the entire library. Commit the evidence, imported records and generated runtime
collections together in the review PR.

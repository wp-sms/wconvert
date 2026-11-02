# 0183: A campaign dialog opens on its preview and its answer

Date: 2026-11-02. Status: accepted.
Amends [0138](0138-one-preview-one-review-one-details.md) decisions 3 and 5,
[0137](0137-details-and-previews-read-at-a-glance.md) decision 2,
[0178](0178-the-first-campaign-is-led-through-its-tabs.md) decision 2 and
[0088](0088-handoff-state-and-required-fixes-lead-the-review.md). GUIDELINES
§"One modal layout" carries the rules. The before/after prototype was the
review gate: claude.ai/artifact/FvDmJKmQTFy7YokWpXuZgC.

Review & publish, Campaign Details and Lead details all worked and all read
long. A review of them on a real campaign found the same two faults:

- **One column, half of it empty.** A 200px preview stood alone on a row of a
  768px dialog, with the goal pushed below it. Details drew its preview 220px
  tall across the whole width, then the Goal, then the results, each on a row of
  its own.
- **Things said twice, or to no one.** Review said "counts Email submissions" in
  its header and "Counts as success: Email submissions" a few lines later.
  Details said the number's name three times. A lead showed the same date as
  When and as Agreed, and "1 submission" about the one on screen.

## Decisions

1. **A campaign's dialog opens on one row: the preview at the start, its answer
   beside it** (`CampaignOverview`). Review's answer is what counts as success.
   Details' answer is how it did. A campaign with no design has no preview, so
   the answer takes the row. Below 640px the two stack. The preview is 200 × 150
   in both, and the editor's Details now shows it too: the two Details were one
   body everywhere except this.
2. **The header says the Goal; the row says the number** (`goalSaid`). The header
   is "Grow my email list", no longer "· counts Email submissions".
3. **How a number is counted is folded into ⓘ** (`GoalMeasure`,
   `MeasurementTip`). This reverses 0138's "never folded away", on purpose. What
   was buried in 0088's disclosure was *what counts*, and that stays on screen:
   the number's name is never folded. The sentence about how it is measured is
   read once, and it taxed every later publish.
4. **In Details, the first number is the Goal.** It carries the target mark and
   ⓘ, because a separate goal line would have repeated "Email submissions"
   directly above it. A draft, a quiet period, a failed read or a message has no
   such number, so there it says **Counts as success** as Review does. A draft
   with no numbers names no period either. *This departs from the sketch the
   merchant chose; the prototype flagged it and they approved.*
5. **The number's name is said once.** "Counts Quiz completions" under Visitor
   action goes, in every dialog that reads How it runs: the row above says it.
   **Review & publish also loses what changes nothing:** the Template line (the
   preview shows the design), How it runs' Display rules link (each row goes to
   its own setting), "Visitors see it wherever its display rules allow." and
   "Rows marked Default use WConvert's starting settings." (the tag explains
   itself). A footer note now appears only when publishing differs from what the
   merchant would assume: saving edits first, replacing the published version, or
   why it cannot publish. The Playbook read that fed the Template line is gone
   from the editor.
6. **Consent says what the visitor sees:** "Checkbox on the form", "No checkbox
   on the form" (the warning) or "Not asked on this form", instead of "Shown" and
   "Not shown".
7. **Lead details says less, and scans like the others.** "1 submission" appears
   only from two up. Agreed appears only when it reads differently from When, in
   the site's timezone. The note that consent wording is not a current
   subscription moves into ⓘ beside Consent. Came from and Consent become the
   shared icon list ([0137](0137-details-and-previews-read-at-a-glance.md));
   Answers and Other details stay plain, because their labels are the visitor's
   own questions and tracking keys, which no icon can stand for and which need
   the width. Their values share one column, so a lead with both still lines up.

## Considered

- **Two full columns** (preview and goal beside How it runs): the shortest
  dialog, but long page names, links and destination warnings wrap in a column
  half the width.
- **Hiding Consent unless it is wrong:** one row shorter, but it is worth
  confirming just before going live, and a row that comes and goes is harder to
  scan.
- **Two columns for Lead details:** tidy in the example, but consent wording and
  long page addresses get squeezed.

## Consequences

- `ReadinessDialog` loses `playbook` and `playbookId`; `CampaignSummary` and
  `CampaignDetailsDialog` lose `goalId`; `campaignFacts` loses `counts`.
- `.wconvert-facts dt` aligns on its text's baseline, not its centre, so every
  fact list's label now shares a line with its answer. Before, labels sat a few
  pixels above their values.
- A Goal that could not be read leaves the space beside the preview empty: the
  header says "Goal unavailable", and there is nothing true to put there.
- `.wconvert-campaign-detail-stats` wraps rather than dividing the width by
  three, so the Goal's number keeps its label on one line beside a preview.
- No storage, route or schema change. Consent records keep every date they had:
  an Agreed time hidden here is still in the export.

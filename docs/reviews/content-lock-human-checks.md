# Content lock: remaining human checks

Use a disposable test site with a published, lock-enabled inline Campaign. Start
with the [setup guide](../guides/content-lock.md). These checks supplement the
[automated browser review](2026-09-20-content-lock-browser-qa.md); they are not
recorded as completed by automation.

## A short session with a content writer

Give the writer these tasks without explaining which block to choose. Observe
first; help only if they get stuck. Use ordinary paragraphs, headings and lists.

| Task | What success looks like |
|---|---|
| Add a signup gate after the introduction of an existing long article | They find Lock from here, select a Campaign in the sidebar and keep the existing article blocks intact |
| Write a new article with a public opening and a locked remainder | They continue writing below the divider and understand that later content is also included |
| Offer a short bonus followed by a public conclusion | They choose Content lock for the bonus and leave the conclusion outside it |
| Change the Campaign, move the boundary, then remove the lock | They can find the controls and keep all article content; Undo restores the lock |
| Check the result as a reader | They use the published page in a private window, submit the form and identify exactly what was revealed |

Record task completion without help, the first point of hesitation, unexpected
public/locked content, and the writer's own words. Ask: “What would happen if you
added another paragraph at the end?” Do not count a developer using editor APIs
as a participant completing these tasks. Prioritize repeated confusion over
adding another block or option after one suggestion.

## Accessibility and a physical phone

Record the browser, WordPress version, device and assistive technology for each
check, alongside pass/fail and the exact reproduction steps.

- With a screen reader, choose/change/clear a Campaign and hear its label and
  unavailable-state guidance. Refresh should announce the result without moving
  focus unexpectedly.
- As a reader, navigate the form with a keyboard and screen reader. Hidden content
  must stay out of navigation. Confirm the unlock announcement is heard once,
  then activate **Continue to content** and confirm the reading position moves
  into the revealed region.
- At actual browser 200% zoom, check the editor sidebar, long Campaign names,
  warning text, visitor fields and buttons. Controls must remain reachable and
  text must not overlap. Browser page-scale emulation alone does not verify this.
- On a physical phone, test Campaign selection and the visitor form with the
  software keyboard open. Confirm scrolling, selection, error correction and
  revealed-content navigation remain usable.
- Repeat the visitor form in an RTL locale and inspect mixed-direction names,
  email entry and the revealed content with a reader familiar with that language.

A failure should produce a focused fix and a repeat of the affected task. These
sessions do not authorize a release or live email/SMS delivery tests.

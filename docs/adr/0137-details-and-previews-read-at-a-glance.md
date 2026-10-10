# 0137: Details and previews read at a glance

Date: 2026-10-10. Status: accepted.
Amends [0131](0131-one-way-to-show-each-thing-in-the-admin.md) decision 1
(Details' footer), [0112](0112-template-discovery-and-reviewed-collections.md)
(the journey test in setup inspection, and the default fit),
[0087](0087-choices-first-details-on-demand.md) ("Have ready") and
[0069](0069-the-library-helps-merchants-compare-before-applying.md) (the design
detail's layout, wording and focus). GUIDELINES §"One modal layout" carries the
rules.

A review of the three read-mostly modals on a live site found each one worked
and none could be read at a glance:

- **Campaign Details** read its stats as "1 submission · 0 Shown · —" with
  nothing saying what the dash meant, said "1 selected page" without naming
  it, and followed "New leads are saved in WConvert." with "Nowhere. Leads are
  still captured here, and exported." Its "Shows to" section also held timing,
  frequency and dates. Status changes were only in the row's ⋯ menu.
- **The setup preview** opened its design cut off (fit width), drew its screen
  choice like tabs, offered a "Try visitor journey" mode with a second device
  switch and test panels, listed an optional email service under "Have ready"
  beside checkbox-like circles, and repeated the header's format as a fact.
- **The editor's design preview** kept "Browse designs" as its title with the
  design's name as a small heading, pushed the preview below the fold with two
  large content cards, and put a long replacement paragraph in the side column
  beside a "Preview with your content" label that repeated the choice above it.

## Decisions

1. **One fact list** — `shell/FactList`: a label beside a 16px icon, then its
   answer, one line each, `tone: 'warning'` for a fact that needs a look. It is
   extracted from the setup preview's list and is now how all three modals
   show facts, so they scan the same way.
2. **Details reads top to bottom as the merchant asks.** One callout for
   anything that needs attention (no design, suspended, unpublished changes —
   the same sentences, merged); the preview; the period's results under one
   line ("Last 30 days · Sep 10 – Oct 9"), with a caption under a missing rate
   ("Shows once it has been shown") and under zero views beside submissions;
   then **How it runs** as one fact list — Who, Where, Opens, How often, Runs,
   and Leads go to (or Visitors go to, with the links, for a click campaign).
   Where names up to three pages, resolving post and term ids through
   `wp/v2/search`, then "+N more"; a page core does not return, or a failed
   read, falls back to the count. Leads go to says **Kept in WConvert only**
   (0131 §5's name for local mode) when nothing is bound, and each destination
   problem is its own warning line.
3. **Details' footer: ⋯, View report, then the editor.** The ⋯ holds Publish
   saved draft or Unpublish, Duplicate as draft and View submissions. Delete
   stays in the row's menu only, so the destructive action lives in one place.
   The primary says **Continue editing** on a draft and **Open editor**
   otherwise, as the list's Next action does.
4. **A status change asked from Details confirms in place.** The footer
   becomes the question — the list's confirm title and description, with
   Cancel and the outcome-named action — because a dialog never stacks another.
   Confirming runs the list's own path and closes Details; Cancel and Escape
   put the caret back on the ⋯. `optins/decisionCopy` holds the words both
   read.
5. **The setup preview is for looking.** One toolbar row: Desktop | Mobile, a
   visibly labelled **Screen** choice, and an icon toggle at the end that names
   what pressing it does ("Fit whole design" / "Actual width"). The journey
   test is out of setup inspection — it lives in the editor — though the
   preview stays clickable. The side column is the use case, the gist, the
   facts without Format (the header says it) with **Counts as success**, then
   **You'll need** as a plain bulleted list. A service is not a requirement:
   it is a muted **Optional** line, "Connect an email service. Leads are kept
   in WConvert either way." The preview column fills the body.
6. **Fit follows the device.** Full inspections open on the whole design on
   desktop and on the width on a phone, so a tall phone form stays readable by
   scrolling (0112's reason, now applied only where it holds). A merchant's own
   choice holds until they switch device. `usePreviewView` is the one source.
7. **The editor's design preview is laid out like the setup preview.** While a
   design is inspected, the dialog's title is its name, with Current design as
   a badge and "Popup · Collects Email address" as the meta line; the library
   switch steps aside and focus moves to the title. Preview on the start side
   with the shared controls and default fit; beside it, **Content** as two
   compact radios ("Keep my words and images", "Use the design's sample
   content", one help line each), the fact list, and the existing transfer,
   content-lock, format, refusal and act-change notes. What applying does is
   the footer's note — "Replaces this draft's design. You can undo.", plus
   "Field mappings for missing fields are removed." when some would be — and
   the Apply button is still described by it.

## Consequences

- `PreviewControls` loses its `journey` prop; nothing else passed it. The pack
  detail and the transfer review get the icon toggle with no other change.
- `destinationsSaid`'s empty sentence changed. Only Details reads it; the
  launch review words an unbound campaign itself.
- `whereReading` takes an optional `named` for callers that can resolve names;
  the editor's sentence still counts, because it cannot wait for a lookup.
- No storage, route or schema change.

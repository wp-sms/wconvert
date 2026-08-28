# The admin speaks only when it changes what you do next

Four rules, and they are one idea from four sides: **a screen earns every pixel
and every word it spends, or it spends neither.**

They are written down because the failures they name are not taste. Each one was
found by looking at a real screen, each traces back to a rule this codebase
*already stated somewhere else and did not apply here*, and each will be
re-introduced by the next person who reasons only from the component in front of
them.

## 1. A container owns the rhythm. Its children own none

**A box with a `gap` may not contain a child that sets a block margin.**

The Design tab was breaking this three ways at once. Its body was a flex column
with `gap-4`; inside it `.wconvert-editor :is(p, h2, h3, h4, …)` added 0.75rem
above and below every paragraph and heading, and half the components added a
`margin-block` of their own. **Flex gaps do not collapse with margins** — the
same trap that made `mb-4` under the tab strip render as 24px
([ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md)) — so the
space between *"How it looks"* and the presets under it was 16 + 12 + 12 = 40px,
and the space between any two other things was whatever their particular margins
summed to.

The bug is not that a number was wrong. It is that **no number was knowable**: a
reader of `RegionBody` sees `gap-4` and is entitled to believe it. Three systems
compounding silently is worse than one wrong system, because there is nothing to
correct.

The prose rhythm on `.wconvert-editor` is not repealed. It is for **prose**, in
the editors that still render WordPress's controls. A panel of components is not
one of those and does not carry the class.

## 2. Say only what changes what the merchant does next

[ADR 0035](0035-the-admin-owns-its-page.md)'s shell already argued this for the
section subtitles: four sentences *"long enough to be read once and skipped
forever after — which is the worst return a permanent line can earn, because it
taxes every visit and informs one."* It was never applied to the builder, which
had accumulated:

- **A green *"This will work"*** at the top of two tabs, above the gallery the
  merchant came for. Not news — it is the state they already assume, and there
  is no action to take about it. A sound design now says nothing and the band it
  said it in is not drawn.
- **Three passing contrast ratios**, printed on every visit. A passing ratio is
  arithmetic nobody acts on. What is left is the pair that is wrong — and, when
  none is, **one** line confirming the check ran, because silence would leave
  the only AA check a merchant gets on a design invisible.
- ***"Saves straight away, and keeps your words"***, permanently above the
  gallery, answering a question nobody has asked yet. A tab that needs a
  sentence before its first control usually needs a better first control.
- **A text box under the alignment chips**, holding `center`, labelled
  *"Alignment value"*. It is the escape hatch that keeps a token's value
  unvalidated ([ADR 0010](0010-templates-are-configuration-not-documents.md)) —
  and keeping that property never required keeping the box on screen. It is a
  **Custom** option now, and the field appears when it is chosen.

The test is not *"is this true?"* — all four were. It is **"does knowing this
change what they do?"**

## 3. Never offer what will be refused. Mark it before the click, with the reason

The gallery offered every design for the [[Display Type]]. A design converting on
a click cannot serve a [[Goal]] that counts submissions —
`OptinController::refuseAMetricItCannotReport()` rejects that pairing outright
([ADR 0025](0025-cart-recovery-captures-nothing.md)) — so a merchant pressed
*Use this design*, waited for a round trip, and got a red bar.

**The doctrine already existed.** `Availability` and `renderingFor`
([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)) mark a Goal and a
Destination that cannot be taken *before* the click, with the reason, and choose
`hide` or `explain` by surface. The gallery simply was not using it. It does now,
reading `convertingActOf` — the same reading the server and `problemsIn` take, so
the three cannot disagree about which designs match.

**Marked, never hidden**, which is `explain` and not `hide`: a merchant comparing
three designs and finding two has no way to know the third exists or why, and the
reason here is about *their Goal* rather than about the install.

## 4. An error names a door that is on this screen

The refusal said: *"Pick a design that matches the Goal, **or change the
Goal**."* Nothing in the builder changes a Goal — it is chosen at creation. An
instruction pointing at a control that is not there is worse than no instruction,
because the merchant goes looking for it.

This is [ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md)'s
empty-state rule generalised: *"No Optins yet."* is a dead end because it names
the state and not the door. An error has the same obligation and a sharper one,
because it arrives at the moment the merchant is already stuck.

## Consequences

- **A control that acts on the whole draft sits with the draft's title.** Undo
  and Redo moved out of a region toolbar into the page-header band beside `Save
  changes`, which has the same scope. They were costing a full-width bordered
  strip at the top of two tabs for two controls reached occasionally — and that
  strip existed *only* because they were in the wrong place. It is gone.
- **A width that looks fixed is not the same as one that is.** `Save changes` was
  moved beside the name and still read as floating, because it sat beside a
  384px `max-w-sm` **box** rather than beside the words — and a merchant does not
  see an input's edge. The title is sized by its content now.
- **These rules are checkable in review.** "Does this container have a gap and a
  child with a margin?", "does this line change what they do next?", "can this
  option be taken?", "is the door in this error on this screen?" — four questions
  that need no screenshot, which matters because
  [ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md)'s suite
  computes no layout and can see none of it.
- **What this does not do is re-open ADR 0037 or 0039.** The palette, the type
  scale, the two control heights and the region anatomy all hold. What was
  missing under them was an editorial rule — *when does the screen get to
  speak* — and four of the five defects above are that rule's absence rather
  than any of theirs.

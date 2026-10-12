# 0142: One readable Flow map

Date: 2026-10-12. Status: accepted.
Amends [0107](0107-forward-journey-paths-and-flow-editor.md) (React Flow and a
horizontal map), [0108](0108-explicit-journey-graph-and-legacy-migration.md)
(React Flow as the admin view, Smart Edge routing, and which endings must pass
the form), [0134](0134-one-edit-tab-look-screen-element.md) (Flow only where
there is more than one way through) and
[0135](0135-plain-style-controls-exact-values-under-advanced.md) decision 6 (the
map's tools, Tidy up and dragging).

The Flow view hid who skips a screen, opened at 38% as a thin left-to-right
strip, used up to five words for one idea ("Collect details", "Shown if",
"Check next", "fallback", "Everyone else"), buried branching in a drawing mode,
and appeared and disappeared as a campaign gained and lost its last branch. Two
review rounds agreed the twelve decisions below. The approved clickable
prototype is the review gate: claude.ai/artifact/DSepKjR4jpkGcKEKiFM2m9 (ten
scenarios), reviewed at claude.ai/artifact/2Hk19gwMXdFXvtpSeN2Q5u.

## Decisions

1. **Flow is always available.** A straight campaign shows its one line and
   offers "Send some answers to a different screen" (Pro: the insert dialog's
   branch intent; Free: a PRO lock). It no longer falls back to Canvas when the
   last branch goes.
2. **Top to bottom, readable at Fit.** Fit never goes below 70%; a larger map
   scrolls, and an overview in the corner shows where you are. Plain wheel
   scrolls; Ctrl/⌘-wheel and pinch zoom the map only.
3. **"Only if" splits the line.** A screen with "Only if…" reached by one plain
   line draws as two lines from its source: the labelled one through it, and a
   dashed one around it. On a choose-several question they read "Includes X" /
   "Without X"; on choose-one "X" / "All other answers". A screen reached by
   several lines stays inline and draws its own dashed "If skipped" line when
   that goes somewhere else.
4. **Several follow-ups are one box**: "Any of these" in, every match asked one
   at a time, a dashed "None of these" around it.
5. **No drawing mode and no dragging.** Every line has a "+" (insert a screen
   there); each card says "Then → X" or "If skipped → X", and those open the
   control that sets them. Tidy up, Edit paths and Highlight paths are gone:
   nothing moves a card, so there is nothing to tidy.
6. **Plain words.** Kinds are Question, Message, Form, Result, Ending.
   "Only if…", "Then → X", "If skipped → X", "All other answers", "First match
   wins, top to bottom". Retired: Collect details, Journey complete, Shown if,
   Check next, Choose one path, fallback, Everyone else, Next screen, and
   "journey" in merchant-facing copy. A test in `tests/js/flow-words.test.ts`
   keeps them retired.
7. **Color means an answer.** Each answer some rule uses gets one of six
   answer colors (`--answer-1…6`), in reading order, shared by its line, the
   "Only if" chip and the result that uses it. Past six, only the selected
   question's answers keep color. A line keeps its color until a card with
   more than one line in. Red stays for problems; the chart palette is never
   used.
8. **Endings may skip the gate, computed, not stored.** The gate is the
   required form, or for find-a-match the result. An ending no route to it
   passes through the gate is *early* and says "Ends without saving details"
   (or "without a result"); one some visitors reach both ways says "Some
   visitors end here without saving details". Both publish while at least one
   ending comes after the gate. A change that newly lets some visitors skip
   the form is reviewed once ("Check this change"), as the prototype did.
   The server (`GraphCaptureContract`) and the editor
   (`structure/gateEndings.ts`) share one fixture.
9. **React Flow is replaced by a plain map**: dagre for a top-to-bottom layout,
   HTML cards and buttons, one SVG for the lines, a scroll container with a CSS
   scale. `@xyflow/react`, `@tisoap/react-flow-smart-edge` and `elkjs` are
   removed. With no dragging or drawing left, React Flow's `role="application"`,
   its inverted aria description key and its label layering cost more than they
   gave. Bringing back drag or draw would need a canvas library again.
10. **"is any of"**: one answer line may match several answers ("My home or My
    flat"). `is` and `is_not` take one to twelve values; the loader already
    read values as any-of.
11. **Arrow keys and Tab.** The map is one roving tab stop like the Edit tree:
    ↑/↓ the previous or next card in reading order, ←/→ the same row (swapped
    in RTL), Home/End, Enter selects, Escape clears a trace. Tab goes from the
    active card to its buttons, then its line labels and "+", then out. Reading
    order is DOM order.
12. **Try a visitor** is a strip inside the map: one control per question
    reached, resolved by the loader's own `graphTrace`. Visited cards and lines
    are marked, skipped ones dashed, a group says "asked n of m", and the
    result reached is named. Preview's "Show this path on the map" feeds the
    same state; any edit clears it.

And a **truthful Free banner**: a draft using answer lines "can't be published;
a live copy is paused; your draft keeps saving" — what `OptinController` and
`Degradation` actually do.

## Consequences

- No schema change: everything lives in the optin's config JSON. An early
  ending is derived on read, never stored.
- The map's admin chunk drops React Flow, Smart Edge and ELK. Dagre stays.
- Layout is computed only when the model or the measured card sizes change;
  cards are keyed by screen id, so focus survives a re-layout.
- The edge-id contract (`${screen}-${priority}`, `${screen}-hidden` for
  version 2) is unchanged, so `journeyTraceEdges` maps a trace onto the new
  lines one to one.
- Manually arranged layouts are gone with dragging. No stored layout existed.
- The map's scroll box is `dir="ltr"`: the layout has already mirrored RTL,
  and a scroll box in RTL would count its scroll backwards. Card text keeps
  the page's direction. GUIDELINES §15 lists this as its fourth exception.
- A follow-up box does not expand into separate cards; each member is a
  button that opens its screen, as in the prototype.
- The first card no longer repeats the display rules, and the form card says
  where leads go without a link: both are one click away in the panel.
- A question's lines are laid out in the order they are checked, "All other
  answers" last, with their screens on one row (dagre is fed the lines last
  to first, and answer lines weigh 8). Several follow-up messages on one
  question are one box on the map, as follow-up questions are.
- An ending some visitors reach without the gate was first refused here,
  where the prototype allowed it. Asked on 2026-10-12, the decision went to the
  prototype: it publishes, with the note on its card. A visitor who skips the
  form on the way there leaves no lead; the merchant sees that on the map.
- Colors, checked against the prototype and the real panel on 2026-10-12:
  only an answer named alone by a rule gets a color, since only those rules
  show one; an answer used inside a two-part rule stayed colored in the panel
  but appeared nowhere on the map. The screen panel lists a question's lines
  with their colors, and Results and "Arrives from" carry the same dots.
  Around a selection, grey lines turn dark rather than teal: teal is a
  visitor's path only. The line key stays three short items.

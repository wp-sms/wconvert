# Every control has the shape of its value

Building one *Promote a sale or offer* Optin with a countdown on it turned up
seven problems in the admin. Six are the same two failures wearing different
clothes: **a control that does not have the shape of the value it edits**, and
**a screen that states a fact without saying what to do about it.**

[ADR 0010](0010-templates-are-configuration-not-documents.md) already wrote the
first half of the answer, and
[`Tokens.tsx`](../../resources/admin/src/builder/Tokens.tsx) restates it
verbatim over `TokenField`:

> A CONTROL THAT ENUMERATES READS THE MANIFEST. ONE THAT INFERS READS THE VALUE.

That is a complete dispatch rule and it is not what was missing. What was
missing is the sentence that closes the gap between its two arms: **what happens
to a value that neither enumerates nor infers.** Today's answer is a raw text
box, permanently, and three of the seven problems are that box.

Five rules. Each one is written against a live counter-example rather than a
principle, because the principle was already written down and did not stop any
of them.

## 1. A control that enumerates reads the manifest. One that infers reads the value

Unchanged, and cited rather than restated — [ADR 0010](0010-templates-are-configuration-not-documents.md),
`Tokens.tsx`'s `TokenField`, `panel.ts`'s `groupOf`. It is the rule the four
below are consistent with; none of them is an exception to it.

The only thing worth adding is why it keeps working: **neither arm names a
token.** `groupOf` reads shapes, `TokenField` dispatches on the resolved value,
and `CHOICES` is a sibling section of the manifest rather than a table in the
bundle. A rule that required a per-token entry in `Tokens.tsx` would be the
second spelling this codebase refuses everywhere else, and every rule below is
built to avoid needing one.

> Extended by [ADR 0077](0077-editor-controls-make-placement-and-formatting-explicit.md): single pixel shadows expose geometry, color and inset controls. Complex CSS is still preserved verbatim. The compact preset select and optional CSS edit icon are refined in [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md).

> Refined by [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md): alignment and borders use compact icons, textual choices use selects, and booleans use checkboxes; manifest section membership and order keep related fields together. Unrecognised tokens still use value-based grouping.

## 2. A free-text box is an escape you opt into, never the control you land on

*Amended by [ADR 0135](0135-plain-style-controls-exact-values-under-advanced.md): the escape hatch is now behind one switch per panel,
**Advanced**, rather than beside each control. The plain view never shows a
typed box; a value only CSS can say reads "This value is set in CSS. Open
Advanced to change it."*

**Where a shape cannot be inferred, the manifest enumerates it.**

`shadow` is the counter-example, and it is a clean one because nothing was
broken — every part of the dispatch behaved exactly as designed and the outcome
was still a text box on every visit, for every design, forever.

`shadow` has no `choices` entry, so the manifest arm has nothing to offer. Its
value is `0 10px 40px rgba(0, 0, 0, 0.18)` — four components and a colour —
which `measureOf` correctly refuses, because a slider that could express it
would be a slider that could clobber it. `isColour` says no, `isCssImage` says
no. So it fell through to `Tokens.tsx`'s last branch and got
`<input type="text">`, and the merchant's question — *how much shadow?* — was
answered with a box wanting a CSS `box-shadow` value typed by hand.

That is the exact defect [ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 2 named for `align` (*"a text box under the alignment chips, holding
`center`"*) arriving one layer earlier: not a redundant box beside a control,
but a box **as** the control.

The fix is four strings in `manifest.json` and four words in
`TemplateLabels::tokenValues()`. No new component: a `choices` entry routes the
token to `ChoiceField`, which is chips plus a **Custom** escape, and that escape
is what keeps ADR 0010's *token values are unvalidated on both sides of the
boundary* literally true.

**So the trailing text box is not deleted; it is demoted.** After this it is
reachable from exactly two places — pressing *Custom*, and holding a value
nothing in the bundle can read — and both of those are a merchant who has
already said something specific. It is never where somebody lands.

### `choices` is an offer, and the library is not renormalised to match it

Nine designs declare a `shadow`. **Seven declare one the four chips do not
offer**, and three of those point **up** — `bar-countdown`'s
`0 -6px 24px rgba(69, 10, 10, 0.35)`, because a bar sits at the bottom of the
viewport and casts onto the page above it, and all four offered values point
down. The rest are tinted rather than neutral: `slide-in-review` casts
`rgba(2, 6, 23, 0.5)`, `popup-two-column` casts green-black.

Those designs open on **Custom, with their own value intact.** That is
`choices` behaving as ADR 0010 defines it — an offer, never a limit — and the
tempting repair is the wrong one: **do not rewrite the library's shadows to land
on a chip.** A merchant who then presses *Normal* on a floating bar does get a
downward shadow, and that is their choice, one undo away, and exactly the
property every colour chip already has.

### And nothing here validates anything

`TemplateVocabulary::tokens()` checks token *names* and accepts any string as a
value, so `box-shadow: banana` reaches the page and the CSSOM drops the
declaration in silence. That is true of every token, it is documented, and
jsdom will not catch it either — its CSSOM never rejects a bad value. **Adding
validation to one control would imply the other twenty-one have it.** They do
not, deliberately, and a chip strip is not the place to change that.

### A parser that widens still says where it stops

`measureOf` requires a unit, so `"0"` returns null: `split-hero` ships
`"pad": "0"` and every Optin started from it inherited a permanent text box for
its inner spacing. And four designs — the three bars and `inline-cart-nudge` —
ship two-value padding like `0.75rem 1.25rem`, which no single slider can say.

Widening it to `measuresOf`, returning **one or two** components, fixes both.
What it does not do is finish the job, and the ADR says so rather than letting
the code imply it: **CSS allows three- and four-value padding and this parser
caps at two.** Anything past that falls to the Custom box, which is rule 2
working as designed rather than a gap in it.

Two consequences worth pinning:

- **The two sliders are named in logical terms.** `padding: a b` is block then
  inline, so they are *Top and bottom* and *Sides* — never *Left and right*.
  The renderer is written in logical properties precisely because writing
  direction crosses every boundary, and the admin has `useDirection`.
- **A unitless zero takes its unit from the manifest fallback**, not from the
  browser. `measuresOf("0")` yields an amount with no unit and a dragged slider
  has to write *something*; `1.5rem` → `rem` is the design's own answer, and
  reading a computed value off the document would be the admin's answer to a
  question about the merchant's design.

**Extended by [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md):** Parseable one-/two-value lengths also offer amount and
unit inputs outside slider ranges. Changing a unit preserves the number and
never performs an inferred conversion. Custom CSS remains available; incomplete
number/CSS text commits on Enter or blur and Escape cancels unapplied text.
Colour text now accepts CSS strings without hex-only filtering. Opening controls
writes nothing; clearing an override and explicit `0`/`none` remain different.
This does not add value validation, token names or new mobile semantics.

## 3. A closed set of pictures is picked as pictures

`icon.name` offers six glyphs — a tick, a star, a lightning bolt, a gift, a
clock, a delivery van — and the control offers six **nouns**. The merchant picks
a word and finds out what it drew by looking at the preview.

There is no sourcing problem to solve. `render.ts` owns the path data, the admin
already imports that module to draw previews, and `GLYPHS` is already used
inside it — so exporting it adds one identifier and ships no bytes. One source,
nothing copied, and `npm run check:loader` proves the second half rather than
assuming it.

The word stays under the glyph. It is the accessible name, it is already
translated, and `TemplateLabels`'s `icon.name.*` entries carry translator notes
saying what each icon is *for*. The picture is `aria-hidden` in the picker for
the same reason it is in the renderer: *"check, Free shipping"* is noise.

**Emoji is refused**, and the argument is `render.ts`'s own, written here so it
is not reproposed by somebody reading only the picker: an emoji is a different
picture per platform and carries its own colour, a dingbat glyph is missing from
plenty of system stacks, and an icon *font* is a `@font-face` — which this
renderer cannot ship at all, because a face declared inside a shadow root is
silently ignored (`css.ts`).

Widening past six is a separate decision, not a hard one: it costs a manifest
entry, a `GLYPHS` entry and a label, and all three are already parity-tested.

## 4. A control that depends on a value edited elsewhere names that value and points at it

A `countdown` block's inspector is one *Show this* checkbox. That is correct —
the node declares `params: ["hidden"]` and no `choices`, because
[ADR 0052](0052-a-countdown-counts-to-the-optins-own-schedule-end.md) settled
that a countdown carries no deadline of its own and counts to the Optin's
`ends_at`. **That stays.** The defect is not the missing control; it is the
missing sentence.

A merchant who drops a countdown onto a design is looking at a clock counting to
nothing, on a tab that contains no field that could change it, with nothing
saying where the deadline lives. So the inspector says what it counts to, in one
of three states, and offers the route:

| State | What it says |
|---|---|
| An end date in the future | *Counts down to 27 November 2026, 09:00 — when this Optin stops running.* |
| No end date | *This Optin has no end date, so the clock will be empty on the page.* |
| An end date in the past | *Counted down to 3 August 2026. This Optin has already stopped running.* |

This is [ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 4 — *an error names a door that is on this screen* — generalised from
errors to dependencies. Rule 4 said an instruction pointing at a control that is
not there is worse than no instruction. The generalisation is that **naming the
control is not enough either**: the line comes with a button that switches to
the Rules tab, opens *How often* and focuses the field.

> _Amended by [ADR 0129](0129-display-rules-plain-questions-and-quick-picks.md): this originally read "opens *How often*". The button opens *Dates* instead, on Between two dates, and focuses the end field._

Two things this deliberately does not do:

- **The preview keeps its fake deadline.** `Preview.tsx`'s
  `A_PREVIEW_DEADLINE` argues its own case and the argument holds: a dead clock
  is a preview of nothing, and the preview is a picture of the *design* the same
  way the placeholder headline beside it is. The inspector is where the truth
  about this Optin belongs.
- **`ends_at` is formatted as wall time.** It is stored as `Y-m-d H:i` with no
  zone on it — the trap ADR 0050 already names — so `new Date(stored)` reads it
  as UTC or as the browser's zone depending on its shape and puts the wrong hour
  in front of the merchant. `HowOften.tsx` gets this right by handing the raw
  string to a `datetime-local` input; the sentence gets it right by formatting
  the parts.

## 5. A one-of-N control is chips while N is small, and a list once it is not

Segmented chips are the house treatment for one-of-N
([ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 5, one declaration read by every strip), and this rule is not an exception
to that. It is the boundary condition rule 5 never had to state, because until
now **every one-of-N in this admin had an N the manifest controlled** — three
alignments, four weights, four speeds, six icons.

`font` is the first that does not. It offers four system stacks today; the point
of Ticket B is that it should offer the families **the site itself declares**,
and a block theme may declare twenty or thirty. Thirty chips in a wrapping
segmented strip is not a font picker.

So the treatment switches at a count the manifest does not control, and it
switches to one that already exists: `ColourField` is a Radix `Popover` whose
trigger shows the current value and whose body is the picker. `font` becomes the
second token wearing that shape rather than the fifth treatment invented — which
is rule 5's actual requirement, one job one control, and not a rule that chips
are the only answer.

`index.css` records why the strip is chips rather than a `<select>` —
`font-family` on an `<option>` is unreliable across browsers — and that is
exactly why the replacement is a popover **list** and not a select: the value of
this control is reading *Georgia* set in Georgia, and a list can do that where a
select cannot. A text input in the popover keeps the Custom escape rule 2
requires.

> **Amended by [ADR 0055](0055-the-font-list-is-the-sites.md): the rows are
> native radios, not a `role="listbox"`.** This originally said `role="listbox"`
> *"keeps the arrow-key behaviour the radio group was giving away for free"*,
> and it does not: the role is a promise the author then has to implement, with
> roving `tabindex` and a key handler. Native radios keep that behaviour for
> real — arrow keys, one tab stop, the set announced as a set, all from the
> browser — which is `ChoiceField`'s own argument for refusing Radix's
> `ToggleGroup`. The popover is where they live now; that is not a reason to
> stop being radios. Everything else in this rule stands as written.

## Consequences

- **`Tokens.tsx` still names no token**, and every rule above was built under
  that constraint. Rule 2 is manifest data, rule 3 is a `renderChoice` callback
  the caller supplies, rule 5 is a shape test on the value. The day the panel
  needs a per-token table is the day one of these was done wrong.
- **The trailing text box is now a statement about the value, not about the
  panel.** Landing on one means the bundle genuinely cannot read what is stored
  — a `clamp()`, a three-value padding, a `var()` — which is information the
  merchant can act on, rather than the panel's default answer to everything.
- **Rule 4 has one more caller than the countdown**, and it is worth naming
  because it will be the next one found: any inspector line that reports a state
  set on another tab. The pattern is the sentence plus the door, not a sentence.
- **ADR 0026's *explain* rendering acquires a second question.** That ADR
  settled *whether* a surface explains an absent thing; the rules panel raised
  *where*, and the answer is recorded inline there rather than here.
- **`CONTEXT.md`'s [[Template]] entry gains one line for rule 2**, because the
  vocabulary being the ceiling on design variety now has a corollary: the
  manifest is also the ceiling on how well a value can be **edited**, and a
  token added with no `choices` and no inferable shape arrives wearing the
  escape hatch.

## What was considered and refused

**A per-token control table in `Tokens.tsx`.** It is the shortest fix for
`shadow` and it is the thing ADR 0010 exists to prevent: a token added to
`manifest.json` would arrive in the panel wearing whatever the table's default
was, and the table would drift from the manifest silently because nothing
compares them. `TemplateLabelParityTest` compares `choices` against labels in
both directions; there is no equivalent test that could exist for a table of
components.

**Renormalising the library's shadows onto the four offered values.** Covered
above: it makes the chips look authoritative by deleting the evidence that they
are not.

**Deleting the trailing text box now that everything routes around it.** It is
the escape hatch, and the escape hatch is load-bearing — ADR 0010's unvalidated
values are what make `clamp(20rem, 50vw, 30rem)` typeable today. Rule 2 is about
where a merchant *lands*, not about what they can *reach*.

**Fixing the countdown by giving the node an `until` param.** That is ADR 0052
reopened, and it is refused there on WCAG 2.2.1 at Level A and on the European
Accessibility Act. The inspector line exists precisely because the control does
not.

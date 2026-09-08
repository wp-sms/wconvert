# A token bag is scoped to the box that carries it

Any layout node may re-declare the design's tokens for itself and everything
inside it. The **names stay the closed 22**; what is new is an answer to
*where*.

```jsonc
{ "type": "stack", "tokens": { "bg": "#fff4df", "fg": "#331e17" },
  "children": [ … ] }
```

That is the whole change. It is not a style attribute, not a class, not a
per-node CSS bag: it is the object a design already carries at the root,
written one level in.

## It was found rather than invented

A 16-design reference set was commissioned to show what the library is missing,
and reading its **source** settled the design question before the design
discussion started. Those pages are not hand-styled documents. They are one
shared component stylesheet plus a token bag per design — fifteen custom
property names, 123 declarations, twelve design scopes. Our architecture,
arrived at independently.

One of those scopes is nested:

```css
.sale-result{ padding:32px; border-top:8px solid #f45a31;
  --paper:#fff4df; --ink:#331e17; --soft:#664b3b; --rule:#d7bda4; }
```

A container re-declaring the same names for what is inside it. Every design in
that set that reads as two materials — a cream panel beside a dark one, a form
on its own ground — does it exactly that way, and none of them needs a second
mechanism to do it.

## Why it costs almost nothing

**Custom properties already inherit.** There is no cascade to implement, no
resolution order to define, and no runtime cost beyond the `setProperty` calls
that write the bag. A leaf reads the nearest bag above it because that is what
the CSS engine does with an inherited property; `render.ts` gained one
four-line function, used at two scopes.

**The names stay closed, so there is still nothing to sanitise.**
[ADR 0010](0010-templates-are-configuration-not-documents.md)'s central claim —
a template has no CSS, so `wp_kses` does not apply to it — is unchanged, and it
is unchanged *because* the bag goes through the same closure the design's own
tokens go through. That was not free. `TemplateVocabulary::node()` copied every
declared param verbatim, which is correct for a scalar and is a **property-name
injection** for a map: an arbitrary key would have reached
`element.style.setProperty('--wc-' + name, value)`, in the one place ADR 0010
says none exists. The fix is a clause beside the `link` and `href` ones, reusing
the private `tokens()` that already validated the design's bag.

**The merchant's model does not grow.** The Style controls are the ones the
Design tab already had; what changed is that they are now addressed at a scope
rather than only at the root. Selecting the step gives you the design's 22, the
way the Design tab always did.

## What it deliberately does not buy

**Arrangement.** There is no per-node `class`, no `style`, no positioning, and
nothing that moves a box somewhere the layout did not put it. Sarah can change
anything about a box — its words, its ground, its edge, its corner, its spacing
— and not where the boxes are. If she wants the photo on the other side, she
picks a different design.

That line is where the canvas would start, and
[ADR 0061](0061-the-vocabulary-widens-by-what-the-library-cannot-draw.md)'s
Depicter teardown recorded the verdict as *avoid competing on canvas complexity
or template quantity*. The line held; the bet
([#15](https://github.com/navidkashani/wconvert/issues/15): the library is the
design surface) is unchanged, and this is what makes the library able to hold up
its end of it.

## The evidence is a different kind than 0061 asked for

ADR 0061 declined per-node styling as *rung 3* and named what would reopen it:

> Three of those, from **real merchants** rather than from a competitor's
> gallery, is the evidence that would make the payload and panel cost worth
> arguing about.

**What we have is a reference set we commissioned.** Not merchant demand — a
brief we wrote, answered by designs we asked for. That is a weaker warrant than
the one 0061 specified and it is recorded here rather than dressed up, because
an ADR that quietly relaxes its own admission test teaches the next reader that
the tests are decorative.

Two things make it worth reopening anyway, and both are about the *shape* of the
purchase rather than the strength of the demand:

1. **0061 priced rung 3 as "every node grows a style bag" and a settings panel
   that "stops being 22 controls and becomes a per-node inspector."** Neither is
   what landed. Only **layouts** carry a bag — a leaf has no inside for a scope
   to apply to — and the panel is the same 22 controls bound to a selection. The
   cost 0061 refused is not the cost that was paid.
2. **0061's own canonical example is this one.** *"The split with a navy pane
   beside a white form"* is named there as the design whose absence is about
   ground rather than placement. It is now expressible, in exactly the terms
   that sentence used.

The payload half of 0061's objection was measured rather than argued: see the
consequences.

## Consequences

- **The scope is a LAYOUT's, and only a layout's.** `tokens` is declared in the
  `params` of `stack`, `row`, `split` and `grid` and on no leaf. A bag on a leaf
  is dropped whole, silently, like any undeclared param.
- **A bag that survives to nothing leaves no key**, so a design whose bag was
  entirely misspelled is byte-identical to one that carries none — the same
  absent-versus-set equality every other param is held to in
  `tests/js/renderer-manifest-parity.test.ts`.
- **`TemplateVocabulary::node()` now has a nested-value clause**, and it is the
  first param that is not a scalar. Anything else nested that is added later
  must go through one of its own; the verbatim copy is safe only for scalars and
  the comment there says so.
- **Scope styling does not survive a design switch**, exactly as tokens do not.
  Picking a new design and keeping the old one's colours is picking neither.
  `MerchantsOwn` still carries the merchant's image and href across, as it does
  today.
- **A literal hex does not follow a theme change.** The Style panel flags one
  and offers a one-click conversion to a token reference, which does.
- **The free loader grew 10 B gzipped**, to 8,178 B of 12,288. The elite loader
  is 10,137 B, leaving 2,151 B.
- **The payload budget is not raised.** `PayloadBudgetTest` measures 1,308 B of
  2,048 today — 36% of headroom, not the breach an earlier estimate claimed. A
  bag is a handful of highly compressible bytes per scope, and the instrument
  changes rather than the budget: the fixture measures the richest design
  actually shipped, and `LibraryLintTest` gains a per-design cap so one
  extravagant design is caught at authoring time rather than at page render.
- **Trees get deeper**, because a scope is a box and boxes nest. `BlockTree`
  indents and collapses already, and collapse state stays in React and never in
  the tree.
- **Translation is untouched.** A bag adds no string, and node ids stay the
  translation key.

# WConvert designs — brief

WConvert is a WordPress lead-capture plugin: popups, floating bars, slide-ins
and inline forms, created goal-first.

**The builder has no canvas.** Issue #15 settled that, and named the
consequence this brief exists to answer:

> the design library is the entire design surface of the product — if the
> library is thin or ugly, the product is thin or ugly, with no canvas for
> users to escape into.

## What the design work is

Take the library from **20 designs to about 42**, and make the ones that exist
worth choosing between.

Everything in `out/` is generated from the shipping code. The cards are the
real library rendered by the real renderer, in the real containers, at three
viewports in both directions — not mock-ups of an intention. If a card looks
wrong, the design is wrong.

**`VOCABULARY.md` is the whole specification**, and it is deliberately
self-contained: it can be pasted into a system that has never seen this
repository and is enough to emit a valid design. Read it before drawing
anything. What it describes is narrow, and the narrowness is the medium rather
than an obstacle to work around.

## Verified inventory

Counted from the shipping libraries.

| | Now | Target |
|---|---|---|
| **Playbooks** (words + rules, no design) | 7 | ~16 |
| **Themes** (token bundles) | 4 | ~12 |
| **Free designs** (`popup`, `inline`) | 12 | ~24 |
| **Pro designs** (`floating_bar`, `slide_in`, + Pro `popup`/`inline`) | 8 | ~18 |

The seven Playbooks point at **three distinct designs** — `offer-panel` ×4,
`centred-card` ×2, `stacked-signup` ×1. The goal-first flow's second step shows
**Playbooks, not designs**, so a merchant coming through the front door sees
seven cards, four of which are one design wearing different words. That is the
sharpest single problem here.

## Constraints — settled, not open

**A design carries no words.** Copy lives on the Playbook, and a design's own
text is placeholder a visitor never reads. This is what keeps the library
small: with copy held elsewhere a design is goal-agnostic, so the gallery is *N
designs per Display Type* rather than a design for every pairing of Display
Type and Goal. **Do not design "a Black Friday popup".** Design a popup that a
Black Friday Playbook can fill.

**Nothing can be imported.** A design is a node tree over a closed vocabulary —
the layouts, the leaves and the CSS custom properties `VOCABULARY.md` lists —
and anything unrecognised is dropped **silently**. So HTML from anywhere else
cannot cross: positioned badges, decorative shapes and second CTAs have no home
and vanish without a word. There is no HTML→JSON mapper and there will not be
one.

**Tokens have a SCOPE, and that is the ceiling lift.** The design sets them for
the whole of itself, and **any layout node re-declares the same names for what
is inside it** by carrying a `tokens` bag of its own — so a pane can be tinted
and the form can have a different ground from the headline (ADR 0062). The names
are the same closed set at every scope; bags nest.

**What no bag reaches is ARRANGEMENT.** No per-node `class`, no `style`, no
positioning, nothing that moves a box somewhere the layout did not put it. A
design that wants the picture on the other side is a different design. That is
the real ceiling and it is deliberate (ADR 0061, ADR 0062).

**Token values are unvalidated.** Only the names are checked. `clamp()` widths,
asymmetric `pad`, gradients and arbitrary radii all work — the "suggested
values" in `VOCABULARY.md` are what the settings panel offers as chips, *an
offer, not a limit*. This is where most of the available variety actually
lives.

**Count is not the target.** Claspo ships 1000+ templates, OptinMonster 700+,
Depicter 600+, and 16 of 16 competitors ship a big gallery. The research
verdict was explicit:

> WConvert should not set "hundreds of templates" as a launch KPI. The useful
> unit is a complete, trustworthy playbook with a small set of strong visual
> variants.

What only ~5 of 16 ship is **templates with purpose-matched rules**. That is
where the effort goes: Playbooks first, then themes, then designs.

## What to ask for

**Whole sheets, not single designs.** The question worth answering is whether
forty designs read as forty designs — which is visible in a contact sheet and
in nothing else. Bring 3–4 directions for a *family*, judged together.

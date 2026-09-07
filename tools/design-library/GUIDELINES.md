# WConvert designs — guidelines

The durable half. `BRIEF.md` is about one job and goes stale when that job
ships; this is how the library works and is meant to last.

`VOCABULARY.md` says what you **can** write. This says what is worth writing.
Where the two disagree, the vocabulary wins — it is generated from the manifest
that validates your file, and this is prose.

---

## 1. The conversion heuristics

**These are the checks.** `.claude/skills/design-a-template` walks this list
against every new design, and a design that fails one is changed or the failure
is argued in the file's own docblock. They are ordered by how often they are
got wrong.

### 1.1 One ask, and it is legible in two seconds

A visitor gives you about that long. The design has to answer *what do I get*
and *what do I give* before anything else lands, which means the trade goes in
the **headline** — not the body, and never only the button.

*"Get 10% off your first order"* is the trade. *"Join our newsletter"* is the
mechanism, and nobody wants the mechanism.

Enforced structurally elsewhere: an Optin has exactly **one** converting act,
so a second button is refused at registration. This is the same rule one level
up — one ask, not two things a visitor must choose between.

### 1.2 The reward is specific, or it is not a reward

*10% off*, *the forty-page guide*, *first pick on Fridays*. Not *exclusive
offers*, *great content*, *stay in the loop*. A placeholder that hedges teaches
every merchant who starts from it to hedge.

Design placeholders are the one thing in the library a merchant reads before
they write, so they are the house style whether or not anyone meant them to be.

### 1.3 Ask for the least that makes the trade work

Every field costs conversions. Two is a lot; three needs a reason a visitor can
see. A `name` field is worth it when the words that follow are personal and not
otherwise.

`phone` is a different question from `email`, not a bigger one: it carries its
own consent obligations, so a design that asks for a phone number puts the
consent line **where it is read**, not under the fold.

### 1.4 Urgency has to be real

A `countdown` counts to the Optin's own schedule end and nothing else — there
is no evergreen timer in this vocabulary, and there will not be one, because a
deadline that resets is a lie told on a schedule.

The same rule covers the words: no invented stock counts, no *"3 people are
viewing this"*, no unverifiable social proof. `rating` draws whole stars only,
and the words beside them are the merchant's to make true.

Competitor teardowns put this exact failure on the avoid list:
*"false urgency, raw visitor counts or unverified purchase claims"*.

### 1.5 The success step is a screen

A submit-metered design has two steps and **the second one is a real thing a
real visitor looks at**. It has to say what happens next — *check your inbox*,
*here is the code* — and it has to look like it belongs to the first step.

The commonest defect in the library is a success step that is two lines of
unstyled text under a heading, which is why the contact sheet gives every step
its own cell.

Where the payout is a discount code, it goes in a `code` node. There is nowhere
else for it that a visitor can read off a phone.

### 1.6 320px is the design width

More than half of this traffic arrives on a phone, and everything wraps at 320
— a `split` stacks, a `row` breaks, a `grid` drops to one column. So a design is
**tallest** exactly where the screen is shortest.

Check the 320 sheet first. A design that only works at 1440 is a design that
mostly does not work.

### 1.7 A bar is not a narrow popup, and a slide-in is not a small one

A `floating_bar` spans the whole inline axis at the block-end edge, over a page
the visitor is still reading. It gets **one line**: an offer and a CTA, with
`row` and not `stack`, and it does not ask for two fields.

A `slide_in` is capped at 26rem in a corner and may be ignored — so it can be
quieter and longer than a bar, and it must never behave like a modal.

A `popup` interrupts. It has earned the most words and owes the most value.

### 1.8 Contrast is not optional, and a picture makes it worse

`bg-image` and `overlay` are two layers and the order is the feature: `overlay`
paints **on top of** the picture. Light text over a photograph without a wash
is unreadable on some fraction of photographs — which is every photograph a
merchant will swap in later.

`muted` has to stay legible against `bg`. It carries the fine print, which is
where the consent wording lives.

### 1.9 The fine print is load-bearing

*No spam, unsubscribe at any time* is not decoration; it measurably raises
completion. The privacy link is a **label with no destination** — the site
resolves it — so write the label and never an `href`.

A `consent` node ships `hidden: true`. That is deliberate: it is present for
the merchant who needs it and off for the merchant who does not.

### 1.10 Design a shape, never a campaign

A design carries no words. *"A Black Friday popup"* is a Playbook; what the
library needs is a popup a Black Friday Playbook can fill and a book-launch
Playbook can also fill.

The test: if the design only makes sense with its placeholder copy in it, it is
a campaign wearing a design's clothes.

### 1.11 Every slot that holds words claims a Slot Role

A leaf that could carry a Role and does not has no seam for words to travel on,
so a merchant who types into it loses those words the next time they switch
design. There is no rescue for a role-less paragraph.

Roles repeat: three `body` nodes are three benefit lines and a Playbook fills
them in tree order.

---

## 1a. The craft floor

§1 is about whether a design *converts*. This is about whether it looks like
somebody made it. Measured against a specimen of the genre, the library failed
on six things and every one of them was cheap.

**A shadow carries a negative spread, or it is a smudge.**
`0 10px 40px rgba(0,0,0,.18)` spreads the blur outward from the full footprint
and reads as grey haze under the panel. `0 18px 50px -12px rgba(15,23,42,.35)`
pulls it back inside and reads as light. Tint it toward the ink, never pure
black — a neutral shadow under a coloured panel reads as dirt. **A bar's casts
upward**, because a bar sits at the block-end edge.

**Anything at or above 1.5rem takes negative tracking.** `-0.02em` as a floor,
`-0.045em` at display sizes. A large heading at default tracking is the single
most reliable sign that nobody set the type.

**A heading is not a paragraph, and its size is not its scale.** The panel has
to grow with it: 1.75rem of heading in 1.5rem of padding is a headline in a box
that does not fit it. Move `pad` and `heading-size` together.

**Placeholder art is artwork, not a grey camera icon.** A layered SVG gradient
— two or three soft blobs over a diagonal ramp — reads as a picture at any size,
needs no photograph, costs about 400 bytes, and does not look like a missing
asset. That is what an `image` slot should ship with; the merchant swaps it.

**The success step is a design, not a receipt.** Two lines of text centred in a
panel sized for a form is the commonest defect in this library. Give it an
anchor: a tick, or — where the offer pays out in one — a `code`.

**The converting control is the heaviest thing on the panel.** That one is in
the renderer now (`700` at `.8125rem` of block padding) so no design has to
remember it.

**A `split` is two sides, not two floating boxes.** The panes are equal height
and each centres its own contents against the other; a pane holding nothing but
a picture is filled by it. All three are in the renderer, so no design has to
ask.

**`pad` is global, so `pad: 0` is never "let the picture bleed".** It is also
"put the button hard against the opposite edge", because the same zero reaches
every side of every node. Until per-node padding exists (ADR 0061), a `split`
with a picture is a **framed** picture — set a real `pad` and let the pane fill
do the work.

## 2. What makes two designs different

The library's failure mode is **twenty designs that are one design twenty
times**. Colour alone does not fix it — a palette swap is a theme, and themes
are a separate layer applied on top.

Real differentiators, in rough order of how much they change a card:

| Lever | What it buys |
|---|---|
| **Arrangement** | `split` with a picture, a `grid` of three benefits, a `row` that puts the field beside the button |
| **A picture** | The single biggest difference between two cards; `split` is what makes it a differentiator rather than decoration |
| **Density** | 2.5rem of `pad` and a 30rem `width` is a different object from 1rem and 22rem |
| **Type** | `heading-size`, `heading-weight`, `tracking` and `font` together are a voice; a serif at 800 with tight tracking is not the system stack at 700 |
| **The corner** | `radius: 0` and `radius: 1.5rem` read as different products |
| **Ground** | A gradient `bg-image`, a photograph under an `overlay`, or a flat `bg` |

**Two designs that differ only in `accent` are one design.** If two cards on
the contact sheet are hard to tell apart, one of them should not exist.

## 3. Themes are a layer, not a design

A theme is a token bundle — **colours and corners only**. Type, spacing and
width belong to the design, because a centred card and a wide banner do not
want the same measure, and a theme that set them would quietly restyle the
layout the merchant chose in the gallery.

So a theme must look right on **every** design, and a design must survive
**every** theme. Check a new design against Midnight and Minimal, which are the
two extremes.

## 4. Placeholder copy

It is read by merchants and never by visitors, and it is the house style by
default.

- **British English.** *Personalise*, *colour*, *organise*.
- **Sentence case** in headings and buttons. Never Title Case, never SHOUTING.
- **A real offer**, per 1.2. Write *10% off your first order*, not *[discount]*.
- **The button says what happens.** *Send my code*, *Get the guide*, *Back to
  my basket* — not *Submit*, and not *Click here*.
- **No em-dashes in placeholder copy.** They read as authored voice and
  merchants keep them.
- **Nothing site-specific.** No brand names, no prices in currency, no dates.

## 5. Where a design lives

| | Free | Pro |
|---|---|---|
| Path | `resources/templates/library/*.json` | `pro/modules/display-types/templates/*.json` |
| `tier` | `free` | `basic`, `pro` or `elite` |
| Display Types | `popup`, `inline` | any, and the only home of `floating_bar` and `slide_in` |

**A Pro design costs two things a free one does not.** A metadata-only stub in
`resources/templates/locked.json` — the one place a facet is *written* rather
than derived — and a live page at `https://wconvert.com/designs/<slug>/` for
its `preview_url`, because the free install shows a card with a *"See this
design"* link and a dead link is worse than one fewer card.

`id` must be unique across **both** libraries.

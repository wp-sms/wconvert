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
so navigation and optional signup buttons must not introduce unrelated asks.
This is the same rule one level up — one ask, not two things a visitor must choose between.

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

For an enquiry, email supplies the reply address and one optional service
choice can help the business understand the request. Keep name optional unless
the use needs it. The one supported qualification question is `interest`, a
native single-choice select, not a general questionnaire. Every submit design
still needs email or phone. Use the manifest's bounded `{value, label}` options,
keep the sent value stable when changing a label, and provide a clear empty
prompt such as *Choose a service*. See
[ADR 0076](../../docs/adr/0076-an-enquiry-captures-one-optional-choice-before-handoff.md).

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

A capture journey ends with an acknowledgement, and **that is a real screen a
real visitor looks at**. A primary signup may already be saved before an optional
other-channel signup; say that clearly and offer an equally clear Skip action. It acknowledges the captured request and has to look
like it belongs to the first step. Write *Request received* or *Thank you for
requesting the guide*. The form's completion does not prove that a connected
service has subscribed the visitor, confirmed their address or delivered an
email. Do not write *You are subscribed*, *Your code is on its way*, or promise
an inbox-arrival time. See [ADR 0073](../../docs/adr/0073-capture-acknowledgement-is-not-provider-confirmation.md).

The commonest defect in the library is a success step that is two lines of
unstyled text under a heading, which is why the contact sheet gives every step
its own cell.

Where the payout is a discount code, it goes in a `code` node. There is nowhere
else for it that a visitor can read off a phone. *Here is the code* is appropriate
when the step actually displays one; the merchant still has to create a valid
code. A guide or emailed offer needs its delivery destination configured, and
the Playbook's setup notes should say so. A success screen is not evidence that
this setup has been completed.

For a quote request, *Request received* acknowledges what happened. It cannot
promise that a quote is ready, that someone has replied, or that a job is booked.
The Playbook's notes name the remaining placement and service setup. MailPoet's
optional interest mapping applies only to new subscribers; do not imply that
every destination forwards the answer or updates an existing Contact.

Library examples teach the wording for new drafts. Updating them does not
rewrite saved merchant copy or published snapshots; the editor explains the
acknowledgement boundary when merchants edit their success text.

### 1.6 320px is the design width

More than half of this traffic arrives on a phone, and everything wraps at 320
— a `split` stacks, a `row` breaks, a `grid` drops to one column. So a design is
**tallest** exactly where the screen is shortest.

Check the 320 sheet first. A design that only works at 1440 is a design that
mostly does not work.

Review every screen at 320, 390, 768 and 1440px, with longer words, visible
consent and both directions. Inputs use at least 16px text and text fields,
selects and CTAs are at least 44px tall. Keep secondary body copy and fine print
around 14px. Short phones may need vertical scrolling; horizontal overflow or
clipped words are defects. `build.sh renderer library-review` provides the full
collection and repeatable browser measurements for this pass.

### 1.7 A bar is not a narrow popup, and a slide-in is not a small one

A `floating_bar` spans the whole inline axis at either block edge, over a page
the visitor is still reading. Its main content is **one compact row**: an offer,
at most one field and a CTA. A surrounding `stack` can put optional consent
below that row. Let the row wrap at phone widths; do not squeeze in two fields
or force consent into the same line.

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

Check field labels, typed text and browser placeholder text separately. A label
may sit on a dark panel while its input has a light background. Solid-colour
measurements do not establish contrast over a later photograph or gradient.

### 1.9 The fine print is load-bearing

Explain the use of the details in terms of the actual request. Subscription
wording can discuss unsubscribing; an enquiry should say the details are used
to respond, without implying marketing consent. The privacy link is a **label
with no destination** — the site resolves it — so write the label and never an
`href`. Keep the surrounding sentence complete if no policy URL is configured:
*We use these details to respond to your request. %s*.

A `consent` node ships `hidden: true`. That is deliberate: it is present for
the merchant who needs it and off for the merchant who does not.

### 1.10 Design a shape, never a campaign

A design supplies a reusable shape and sample content. *"A Black Friday popup"* is a Playbook; what the
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

Fields derive their Roles from `name`; do not author a `role` on a field.
`interest` derives its question and prompt plus `interest_options`. That last
Role binds `{options: [{value, label}]}` as one structured value. A Playbook
translates labels while stable values remain unchanged. A design without the
Role has nowhere to carry those choices; review the actual Keep/Sample candidate.

Give every shipped leaf a stable `n1`…`n9999` id, unique in its tree, and keep
the id when moving the leaf. Slot Roles may repeat; node ids may not. This is
how translation follows content rather than a changing array position. Author
tree `v: 2`, but never derived facets, and do not rely on PHP's new-node fallback
to renumber a library file on every edit.

---

## 1a. The craft floor

§1 is about whether a design *converts*. This is about whether it looks like
somebody made it. Measured against a specimen of the genre, the library failed
on six things and every one of them was cheap.

**A shadow carries a negative spread, or it is a smudge.**
`0 10px 40px rgba(0,0,0,.18)` spreads the blur outward from the full footprint
and reads as grey haze under the panel. `0 18px 50px -12px rgba(15,23,42,.35)`
pulls it back inside and reads as light. Tint it toward the ink, never pure
black — a neutral shadow under a coloured panel reads as dirt. A bar may sit at
either block edge, so its bundled shadow must read cleanly in both directions.

**Anything at or above 1.5rem takes negative tracking.** `-0.02em` as a floor,
`-0.045em` at display sizes. A large heading at default tracking is the single
most reliable sign that nobody set the type.

**A heading is not a paragraph, and its size is not its scale.** The panel has
to grow with it: 1.75rem of heading in 1.5rem of padding is a headline in a box
that does not fit it. Move `pad` and `heading-size` together.

**Placeholders preserve the composition.** Use a small neutral gradient or an
existing placeholder while production imagery is unavailable. Keep it editable,
review the layout with it absent, and describe it honestly in authoring notes.
Do not generate artwork when the user has requested placeholders. A placeholder
review does not establish that a later photograph has an appropriate crop or
sufficient contrast.

**The success step is a design, not a receipt.** Two lines of text centred in a
panel sized for a form is the commonest defect in this library. Give it an
anchor: a tick, or — where the offer pays out in one — a `code`.

**The converting control is the heaviest thing on the panel.** That one is in
the renderer now (`700` at `.8125rem` of block padding) so no design has to
remember it.

**A field's ground is `--wc-bg`, so on a dark design only the ring shows it.**
Pick a `border` that clearly distinguishes the input from its surroundings.
Where the outline identifies the field, require at least **3:1** against the
adjacent surface. A fill that already contrasts with its surroundings can identify the field; otherwise the outline must contrast with both adjacent surfaces, including the input fill when inset. Include the phone library wrapper in this check. Check the
focused state too. This is separate from text contrast (normally 4.5:1);
passing label and placeholder checks does not prove that a pale field outline
is usable. See [WCAG non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

**Write both a field label and a useful example.** Field-only rows keep visible
labels. In a compact row with a direct button, direct fields with a non-empty
placeholder can have their labels visually hidden above 24rem of container
width; the labels remain accessible. Fields without examples keep their labels,
and all of these compact labels become visible at 24rem and below. Check both
sizes. A missing authored label gets a field-kind fallback, but that fallback
is not a reason to leave the design's wording unfinished. Examples disappear
while typing; include the country code in a phone example. Required fields
receive their asterisk from the renderer, so do not author a second one.

**Review the filled campaign, not just the sample design.** A truck beside an
essay archive is a failed review even if the layout audit passes. An icon must
explain the adjacent content or a real state; remove decoration that merely
adds a row. Inspect optional copy when absent: no orphan icon, empty heading,
empty panel or leftover divider. Apply this to the acknowledgement too.

**Benefit groups share one layout.** Use consistent text panels or stacked
icon-and-text items when phrases can wrap. A wrapping row inside each grid cell
can strand some icons above their labels and leave others beside them. Check
unequal phrase lengths on desktop and 320px, in both directions. Do not shorten
useful campaign wording merely to preserve a decorative icon.

**CTA width follows the job.** A full-width submit works in a compact form; an
inline information card usually needs a content-width link button in a row.
Check the button against its actual label and surrounding content.

Reference review: [Depicter popup, slide-in and notification-bar patterns](../../docs/reviews/template-editorial-refinement-2026-09-28.md).

**A `split` is two sides, not two floating boxes.** The panes are equal height
and each centres its own contents against the other; a pane holding nothing but
a picture is filled by it. All three are in the renderer, so no design has to
ask.

**~~`pad` is global, so `pad: 0` is never "let the picture bleed".~~** It was,
and the sentence has inverted: `pad` is scoped now (ADR 0062), so `pad: 0` on
the DESIGN plus a real `pad` on each box is exactly how a full-bleed split is
written — that is what `fieldwork` does. What survives is the warning that made
it: a zero reaches every side of every node **inside** the box that sets it, so
set it on the design and never on a container holding a form.

**A `media` needs three things or it is not a picture.** `bg-image` in its own
bag, because it resets the design's; `min`, because the spread has nothing to
spread across otherwise and the box collapses to the two lines on it; and `fg`,
because the design's ink was chosen against the design's ground and not against
your photograph. The `overlay` is a layer under the words rather than a
background wash, so a scrim can be as dark as the type needs.

**A `narrow` bag is for retuning, not for shrinking.** Everything that merely
needs to be smaller already is: a `split` stacks, a `grid` drops to one column,
`.wc-root` is `min(width, 100%)`. Reach for `narrow` where the values
themselves are wrong at 360px — a photo pane that is 440px of a split and the
whole width on a phone wants less padding and smaller display type. Two or
three tokens, never the bag again: it is the one thing that doubles what a
design stores (ADR 0064).

**A `min` is only needed where the picture is the taller thing.** `.wc-split`
is `align-items: stretch`, so a `media` beside a form is already the form's
height. Set one anyway and the phone gets a 384px picture above the fold, with
no way to retune it — `narrow` carries tokens and `min` is a param.

**A `notch` is only visible where the halves paint and the design does not.**
Punch a hole in a blue panel sitting on a blue `.wc-root` and the hole shows
blue — the mask removes the panel and the design's ground is still behind it.
So a ticket sets `bg: "#0000"` on the design and paints each half, and the
perforation shows the merchant's page. Pair it with `edges: "block-start"`: the
rule is the tear line and the holes are its ends.

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

It is shown to merchants and can reach visitors through **Use this design's
sample content** (ADR 0075), so it teaches the house style and must be truthful.

- **British English.** *Personalise*, *colour*, *organise*.
- **Sentence case** in headings and buttons. Never Title Case, never SHOUTING.
- **A real offer**, per 1.2. Write *10% off your first order*, not *[discount]*.
- **The button says what happens.** *Send my code*, *Get the guide*, *Back to
  my basket* — not *Submit*, and not *Click here*.
- **No em-dashes in placeholder copy.** They read as authored voice and
  merchants keep them.
- **Make sample requirements explicit in authoring guidance.** Fictional brands
  can establish a voice, but do not invent real customer evidence. Codes, offers,
  dates and destinations must be configured by the merchant before publishing.

## 5. Where a design lives

| | Free | Pro |
|---|---|---|
| Path | `resources/templates/library/*.json` | `pro/modules/display-types/templates/*.json` |
| `tier` | `free` | `basic`, `pro` or `elite` |
| Display Types | `popup`, `inline` | any, and the only home of `floating_bar` and `slide_in` |

**A Pro design costs two things a free one does not.** A metadata-only stub in
`resources/templates/locked.json` — the one place a facet is *written* rather
than derived — and a live page at `https://wconvert.io/designs/<slug>/` for
its `preview_url`, because a paid install missing that rung shows a card with
a *"See this design"* link and a dead link is worse than one fewer card. A free
install is shown no such card (ADR 0116).

`id` must be unique across **both** libraries.

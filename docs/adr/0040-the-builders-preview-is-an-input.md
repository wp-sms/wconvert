# The builder's preview is an input, not only an output

Clicking a headline in the builder's preview puts the caret in the block that
edits it. Focusing that block outlines the headline. The preview stopped being a
picture of the Optin and became a **surface the merchant works on**.

It costs the closed shadow root nothing, it costs
[ADR 0010](0010-templates-are-configuration-not-documents.md)'s boundary nothing,
and it costs the loader twenty-six bytes. This ADR is why all three are true at
once, because the first two look like they cannot be.

*Completed by the post editor's block. **There is now a second place in
wp-admin where an Optin appears beside the words "editor canvas", and this ADR
does not reach it.** `wconvert/inline-optin` draws a labelled placeholder and a
picker — never a render — and the distinction is the one this ADR opens with — and `CONTEXT.md`'s **Anchor** is where the vocabulary
for it now lives.*

*The preview earns the real renderer by being an **input**: clicking a headline
puts the caret in the block that edits it. Nothing on the post editor's screen
can change what an Optin says, so a render there could only be an output — the
static thumbnail [ADR 0010](0010-templates-are-configuration-not-documents.md)
says does not exist anywhere in this flow, with the renderer, the design library
and a template fetch shipped into the post editor to draw a picture nobody can
act on.*

*So the rule this ADR is read for is not "an Optin is drawn wherever it is
referenced in wp-admin". It is that the renderer goes where the picture is
something the merchant works ON, and that is one screen.
[`src/Frontend/InlineOptinBlock.php`](../../src/Frontend/InlineOptinBlock.php)
and [`resources/blocks/inline-optin/src/Edit.tsx`](../../resources/blocks/inline-optin/src/Edit.tsx)
carry the same argument at their own end.*

## The problem it solves

The settings panel is a column of blocks headed by [[Slot Role]] — *Headline*,
*Fine print*, *Consent wording* — beside a live render of the design. A merchant
who wants to change the words under the heading has to work out which of eight
blocks draws which part of the picture, by name, from a vocabulary they never
learned. On a design with two text slots and a fine-print line, the answer is a
guess, and the way to check the guess is to type into one and watch.

The picture already knows. It was built from the tree the blocks edit, one
element per slot, and it has been stamping `data-role` on every one of them since
the renderer was written.

## The shadow root stays closed, and that is not a compromise

[ADR 0009](0009-overlays-render-in-the-top-layer.md) chose `closed` over `open`
for one reason, stated in `mount.ts`: *"a theme script sweeping
`document.querySelectorAll('input')` must not be able to reach the capture field
and rebind it."* That is a hazard on a **visitor's** page, from code WConvert
does not control, against a form that captures somebody's email address.

None of it is in play here. The admin mounts the preview itself, in wp-admin,
against a tree nobody has submitted; there is no third-party script on this page
that could reach in even if the boundary were open, and nothing that could
usefully be rebound if it did.

More to the point, **nothing needed opening.** `mount()` already returns the
rendered step to whoever mounted it, and the comment beside `Mounted.root` says
exactly why:

> *"Handed to the caller rather than the shadow root itself, so `closed` still
> means what it says to everything that did not mount this."*

That sentence was written for a different reader and it is the whole mechanism
here. The builder is a caller; it holds the element it asked for; the boundary is
as closed to everything else as it was before. `Preview.tsx` was discarding the
return value, and now it does not.

The same is true of `data-role`. `render.ts` has stamped it since it was written,
and its comment names this reader by name:

> *"The Role reaches the DOM because two things downstream need it: the
> stylesheet … and the settings panel, which edits slot content BY Role."*

## One renderer line, and what it buys

A `field` is the one slot with no `role` to stamp. Its Roles are **derived** from
what it captures rather than declared (`CONTEXT.md`, Slot Role) — a field
capturing an email offers `email_label` and cannot offer the phone's — so it
carries no `role` key, and the panel heads it with the capture kind instead.

So the renderer stamps `data-captures` beside `data-role`, for `field` nodes
only. That is an addition to the loader's tree, which is the one place in this
codebase where a line has to justify itself in bytes: free's built loader went
from 5,968 to **5,994 bytes gzipped** against a hard budget of 8,192
([ADR 0029](0029-the-free-contract-is-proven-at-the-source.md)), leaving 2,198
spare. `npm run check:loader` is what proves it, per build, and it is the reason
this is recorded rather than assumed.

The alternative was a builder-only render path, which is precisely the thing
ADR 0010 exists to prevent: *"there are no static thumbnails, anywhere in this
flow"* holds because the admin imports the **same** renderer, and a second one
that stamped more would be the first fork.

## Selection edits nothing, so ADR 0010 is where it was

ADR 0010's bargain is that the gallery is the design surface and the panel edits
**content, visibility and tokens — never arrangement**. The tempting next step
from a clickable preview is an editable one: type into the headline where it is
drawn, drag a slot, delete a node. That would move the ceiling on design variety
into a builder nobody designed, and it would cost the no-migration guarantee a
canvas depends on.

*Amended by the structure editor. Two of those three arrived and the third did
not, and the difference is the point this section was making.*

*Dragging a slot and deleting a node are now possible — in a **list beside** the
preview, not in the preview. The `treegrid` is where a block is moved and
removed; the preview is where the result is seen and where a click still says
nothing but "this one". So the traffic below is unchanged: one string, naming a
slot, carrying no way to reach one. Nothing that receives a `SlotKey` gained the
ability to write, and `Preview.tsx` still writes nothing.*

*Typing into the headline where it is drawn is still refused, and for the reason
this section gives: it would need the preview to be an editing surface rather
than a render, which is the fork ADR 0010's "there are no static thumbnails"
depends on not existing.*

*The ceiling did not move either. `structure/catalogue.ts` reads
`manifest.json` and can express nothing outside it, so the editor arranges what
the vocabulary already offers and cannot invent design variety. And there is no
migration, because the tree it edits is the tree that was always stored — which
is ADR 0010's own escape clause being collected rather than a hole in it.*

So the traffic in both directions is **one string, and it names a slot**:

- `role:headline`, or `captures:email` for a field.
- Derived on the panel's side from a `Slot`, and on the preview's side from what
  the renderer stamped, in `resources/admin/src/builder/slots.ts`.
- It carries no way to REACH a slot. It is not a path, not a node, not a
  reference — so nothing that receives one gains the ability to write.

The panel is still the only thing that writes, and it still writes only what it
wrote before. `tests/js/builder-slots.test.ts` asserts the two derivations agree
against a real library entry through the real renderer, because a disagreement
throws nothing and looks like nothing: clicking a headline would simply do
nothing, silently, forever.

*Amended by the editor merge: **a selection is now a `Path` with the `SlotKey`
derived from it**, and this section is still true of the direction it was
written for.*

*A key cannot name every block, which is what forced it. `keyOfSlot` answers
null for a block with no [[Slot Role]], and two role-less blocks of one type
share that absence — so a key-based selection drew both as selected, or neither,
and left exactly those blocks uneditable. They are also precisely the blocks the
editor now warns about, because their words are lost at the next design switch.*

*What the boundary above was protecting is untouched. **The preview still
receives a key**, still cannot reach a node, and still writes nothing. What
gained a path is the panel — the thing that was always the only writer, and
which has addressed nodes by `Path` since `panel.ts` was written. The key
travels beside the path for the preview's benefit and for nothing else.*

*Amended again by [ADR 0051](0051-a-slot-role-repeats-and-binds-in-order.md):
**a key carries an ordinal**, because a [[Slot Role]] repeats and a name
therefore identifies a Role rather than a slot. With three `body` elements on a
step, a click on the third reached the first and selecting any outlined all
three — silently, because nothing throws when the two sides agree on the wrong
slot. The ordinal is counted **per step** and **only over what the renderer
draws**, which are the two things the DOM side can reproduce; the first
occurrence keeps the bare key, and a hidden slot gets none at all. One function
numbers both walks, since two would be exactly the drift this whole seam is
guarding against.*

*Two consequences a key handled for free and a path does not, both now handled
explicitly: a move changes the address, so the selection is re-pointed at the
block rather than at the position it held; and a save replaces the tree, so the
path is re-resolved outward — the block, else whatever held it, else the
design's first block — rather than cleared.*

> **Amended a fourth time, and this one deletes the whole scheme:
> [ADR 0065](0065-the-editor-is-the-scope-editor-now.md). The traffic is the
> PATH, in both directions, and there is one address rather than two that have
> to agree.**
>
> *A Role could not name a `panel`, a `split`, a `stack` or a `media` at all,
> because none of them carries one — so `SLOT_SELECTOR` never matched a
> container and a press on a coloured box reached the nearest leaf inside it.
> For a scope editor whose primary gesture is* select that box *that is not a
> gap in the addressing, it is the feature missing. `image`, `icon`, `divider`
> and `countdown` were unclickable for the same reason.*
>
> *So `render()` stamps `data-path` on every element it draws — **only when the
> caller asks**, through a `RenderOptions` flag `mount()` defaults to silence.
> The payload promise this ADR is careful about is therefore intact in the
> direction it was written for: a visitor's page carries no addresses and pays
> no bytes for them, and the flag is on for exactly one caller.*
>
> *What IS given up is the capability argument, and it is worth being plain
> about rather than reworded. A path is a way to reach a node; a Role was not.
> That mattered when the receiver might have been something other than the
> admin — and it is not: the preview is mounted BY the admin, inside wp-admin,
> in a closed shadow root, by the one program that already holds the tree and
> PATCHes it. An address in that DOM lets nothing write that could not already,
> and `Preview.tsx` still writes nothing.*
>
> *The ordinal, the per-step counting, the two derivations and the
> hidden-slot-has-no-key rule all go with it — a path is distinct by
> construction, and `slots.ts` is a parse and a join. The two-derivation test
> becomes a one-scheme test, which is the same guarantee with less to keep in
> step.*

## Why a string and not an element reference

The preview is remounted on every keystroke — the renderer builds DOM and reads
nothing, so a full re-render is cheaper than a diff, and it is what keeps the
preview a render of the current tree rather than a patched copy of an older one.
Any element reference the panel held would be stale one character later. A key
derived from the tree survives every remount, because it is a fact about the
design rather than about this render of it.

## What this amends

- [ADR 0035](0035-the-admin-owns-its-page.md) said *"the builder's live preview
  is unaffected in both directions"*, which was the one collision worth checking
  before the admin took its own page. One direction is now deliberate traffic.
  Its CSS claim is untouched, and is the reason this was cheap.
- [ADR 0009](0009-overlays-render-in-the-top-layer.md) is **scoped, not
  relaxed** — see above. Its own note now says so.
- [ADR 0010](0010-templates-are-configuration-not-documents.md) is untouched:
  selection edits nothing, so the panel is still the only thing that writes and
  it still writes only content, visibility and tokens. *That last clause is
  amended by the structure editor — see above. Selection still edits nothing;
  what changed is that a second surface, which is not the preview, now writes
  arrangement. Amended again by the editor merge: that second surface and the
  panel are one, on the tab called Content, and it writes words and arrangement
  both. The preview is still not it.*

## Consequences

- **The preview is pinned beside all four builder tabs**, not inside the settings
  panel. It has to be, or selection is an affordance that exists on one tab: a
  merchant editing a Trigger was previously changing an Optin with the picture of
  it somewhere else entirely.
- **Focus is the panel's signal, not click.** Tabbing into a field is the same
  act as reaching it with a mouse, and a keyboard merchant must not lose the
  preview's answer to *which one am I editing?*
- **The caret lands on the words, not on the visibility switch.** A slot the
  panel may hide leads with a *Show this* checkbox, and a merchant who clicked a
  headline wants to edit what it says.
- **Only a selection made in the PREVIEW moves the caret.** One made in the panel
  already has it, and pulling focus to the top of the block on every keystroke's
  re-render would take it out of the field being typed in. The origin travels
  with the key rather than being guessed from timing.
- **The outline is written inline by the admin**, never into the renderer's
  `SHADOW_CSS`. That stylesheet is the loader's, budgeted and shipped to every
  visitor of every site; a builder affordance has no business in it.
- **The converting act cannot act.** The preview is the real render, so the CTA
  is a real `<a>` and the form is a real form. A navigation would take the
  merchant off the builder mid-edit, so the click handler prevents it — the other
  half of the submit guard `mount.ts` already had.

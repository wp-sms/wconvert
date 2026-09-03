# A Slot Role repeats, and a Playbook's words bind in tree order

[[Slot Role]]s were a closed list of thirteen names, **unique across a
Template's whole tree**. Closed is the decision worth keeping. Unique was a
constraint nobody argued for, enforced by a silent key-drop, and it is the
reason twelve shipped designs are the same eight-slot skeleton in different
colours.

## What uniqueness actually cost

The obvious reading is *"a design can only offer one body paragraph, so those
extra words cannot be filled"*. That is not the failure. The failure is worse
and it is invisible from the gallery.

`TemplateVocabulary::normalize()` dropped the `role` key from a second node
claiming a Role and **kept the node**. Then:

1. `withoutCopy()` strips the `copy` keys — `text` among them — from **every**
   text node at snapshot, because a Template carries no words
   ([ADR 0010](0010-templates-are-configuration-not-documents.md)).
2. `SlotRoles::bind()` writes words back **only where a Role binds**.

So a role-less paragraph reached a real Optin as an **empty `<p>`**. A design
with a three-benefit row showed one benefit and two blank lines, in front of a
visitor, on a live site. And the gallery card looked perfect, because a library
entry keeps its own placeholder text and is never snapshotted.

The arithmetic is the other half. Thirteen names, minus `success_headline` and
`success_body` which the terminal step spends, minus `cta_label` on the button,
minus `consent_text` on the consent node, minus the six derived from field
kinds — leaves a submit-metered design **two** free prose slots on step 0:
`headline` and `body`, with `fine_print` as a third if it wants one. Every
design in the library has exactly those, because that is all a design could
have.

## The decision

**Keep the thirteen names closed. Drop the uniqueness.**

A design may claim `body` three times. A [[Playbook]] supplies an array:

```php
'body' => ['Free shipping', 'Early drops', '48h returns'],
```

and the nodes take them **in tree order** — the same order the renderer draws
them in, which is the only order a merchant can see.

Two rules make that total, because `bind()` has to survive a Template switch
and the two designs will not agree about how many of anything they have:

- **A design with fewer slots than the list simply runs out.** The extra words
  write nothing. They are not appended anywhere, because there is nowhere for
  them to go that a visitor would read as intended.
- **A single value fills the first slot only.** Three benefit lines all reading
  *"Free shipping"* is not what a Playbook supplying one line meant, and it is
  the kind of wrong a merchant never thinks to report as a bug.

### The guarantee that does not move

**Binding is still by NAME.** That is the whole reason Slot Roles exist — *"the
words survive switching Template"* (CONTEXT.md, [[Playbook]]) — and repeating a
name does not weaken it. A merchant who wrote three benefits and then picked a
design with three benefit slots gets three benefits. What has changed is only
that the name may be claimed more than once.

### The one genuine ambiguity, and how it is settled

`copyFrom()` returns two shapes that are both PHP arrays and mean opposite
things:

- a Role filling **several keys** — a sentence and the link inside it — comes
  back keyed by those key names, `{text, link}` ([ADR 0013](0013-playbook-copy-carries-no-markup.md));
- a Role claimed by **several nodes** comes back keyed `0, 1, 2`.

`array_is_list()` tells them apart exactly rather than by heuristic, which is
why nothing in `SlotRoles` has to know which node type is which. A Role claimed
once still comes back in the shape it always did, so nothing that was already
correct changes shape on a round trip.

## What it costs elsewhere

**A name no longer identifies a slot.** The builder's preview and its block
tree agree on a slot by a `SlotKey` derived independently on both sides
([ADR 0040](0040-the-builders-preview-is-an-input.md)) — so with three `body`
elements, a click on the third would have reached the first and selecting any
would have outlined all three. Silently: nothing throws when two sides agree on
the wrong slot.

So a key carries an **ordinal**, counted **per step** and **only over the nodes
the renderer draws**. Those are the two things the DOM side can reproduce: the
preview renders one step at a time and skips hidden nodes. The first occurrence
keeps the bare key, because every key in the product today is a first
occurrence. A hidden slot gets no key at all — it is not in the preview, so
there is nothing there to click or to outline, and a key for it would collide
with the next drawn slot of the same name.

One implementation numbers both walks (`panel.ts`'s `numbered()`), because two
would be exactly the drift this is guarding against.

**The role-exhaustion warning is gone**, and its absence is the fix. Adding a
second Heading used to announce *"Every name a Heading can have is already used
in this design, so this one is not linked to the preview"*. That state is now
unreachable from the Add menu: `freeRoleFor()` prefers an unclaimed Role — a
heading on the terminal step should take `success_headline` before it doubles
up — and repeats one rather than returning nothing. A merchant who has just
added a second Body does not need telling that it is a second Body
([ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md),
rule 2).

**`losesWordsOnSwitch` stays**, and still reports a real thing: a hand-authored
design, or an older tree, can still carry a role-less block whose words no seam
carries. `bin/verify-templates.php` reports the same fact at the keyboard.

## What was considered and refused

**Matching prose by ordinal instead of by name.** *"The second paragraph of the
old design becomes the second paragraph of the new one"* needs no vocabulary at
all — and it is precisely what a Slot Role exists not to be. A merchant who
reorders their blocks would find their fine print in the headline, which is the
failure `id` was added to prevent one level down (ADR 0010, amended).

**Opening the list — an arbitrary `role` string.** Then a Playbook and a
Template agree only by coincidence, `TemplateLabels` has nothing to name, and
registration cannot refuse a Playbook that fills a Role its Template does not
declare. The closed list is what makes that refusal possible.

**Numbered names — `body_1`, `body_2`, `body_3`.** A closed list that has to
guess in advance how many benefit lines the widest design will ever want, and a
Playbook that must know which numbers a particular design happens to use. It
is this decision with the ordinal moved into the vocabulary, where it is
everybody's problem instead of the binder's.

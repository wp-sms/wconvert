# The spin-to-win card is withdrawn, because the prize cannot be made real

`popup-spin-to-win` was one of nine treeless cards in
[`resources/templates/locked.json`](../../resources/templates/locked.json) — a
name, a [[Display Type]], authored facets and a link to a live preview on
wconvert.io. [#95](https://github.com/navidkashani/wconvert/issues/95) shipped
six of the nine as real designs and named three as a smaller, later job. Two of
those three were design work and are now authored. **This one is not a design,
and the card is removed rather than drawn.**

Every other entry in that file advertises a *design*: an arrangement of nodes
the vocabulary already declares, one file away from existing. This one
advertised a **mechanism** — a wheel that allocates a prize to the visitor who
spins it. The arrangement was never the hard half; a `split` with a picture and
an email field has been expressible since the library shipped. What the card
promised and this architecture cannot draw is the **outcome**.

## Wall 1: there is no per-visitor prize to give

[ADR 0025](0025-cart-recovery-captures-nothing.md) already settled the general
case, under the heading *No coupon minting, and not as a preference*: the
front-end payload is baked into HTML the full-page cache serves
**byte-identically to every visitor** ([ADR 0003](0003-published-set-projection-no-second-cache.md),
[ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md)), so a
per-visitor code is impossible in this delivery model rather than merely
unwise — *"only a static shared code can ever appear"*. Minting one would also
be a write into WooCommerce's own data, which is
[ADR 0024](0024-wconvert-writes-no-wsms-engagements.md)'s error in a different
table.

A wheel does not get an exemption from that; it gets it **N times over**. Either
every segment's prize ships in the page source, or none does. So the honest
description of a wheel whose segments name static codes the merchant created in
WooCommerce is: *the best prize is one View Source away, and the spin reveals a
code the visitor could have read.* The randomness is real. The **allocation** it
dramatises is not.

The third exit is to spin first and then ask the server which prize. That is a
public, unauthenticated endpoint handing out discount codes on a plugin that
mints no visitor identifier to rate-limit against
([ADR 0017](0017-no-visitor-identifier.md)) — and the count is already written
down: `BeaconController`'s own docblock calls itself *"the second public route
WConvert exposes, and the last."* It would also make the display path
asynchronous where nothing else is, and it is still WConvert allocating coupons.

## Wall 2: the lock that would make one spin mean something cannot be built

*"One spin per visitor"* is a claim about a **person**, and WConvert has none.
ADR 0017 mints no visitor identifier and CONTEXT.md says the consequence out
loud: there is no honest count of people anywhere in this product. `wcv1` is a
**browser record** — a second browser, a private window or a cleared site
setting is a second spin, exactly as
[ADR 0045](0045-an-ab-variant-is-a-whole-optin.md) accepts that one visitor on
two devices meets both arms of a test.

That limit is affordable for an A/B split and for a frequency cap, because both
are the merchant's pacing rather than a promise to the visitor. It is not
affordable for a prize: a wheel that says *you have one spin* and cannot enforce
one spin is a sentence the product cannot keep. The storage is buildable; the
guarantee is not, and the guarantee is the feature.

## Wall 3: the consent question ADR 0052 refused to leave implicit

[ADR 0052](0052-a-countdown-counts-to-the-optins-own-schedule-end.md) parked the
question rather than answering it — *"is remembering a deadline `functional`,
like remembering a dismissal, or does it need consent? That question does not
need answering, because the answer to the feature is no."* A prize outcome asks
it again in a form where it cannot be parked, so here is the answer.

**A stored outcome serves two purposes at once, and they fall in two
categories.**

- *Show me again the code I won* is `functional`, on exactly the reading the
  dismissal record already has: it records something the visitor themselves did,
  and withholding it is worse for them — they lose a code they were given, the
  same way withholding a dismissal makes the popup reappear after they closed
  it.
- *Stop them spinning again* is not. It is the merchant's interest in the
  visitor's device, it is the half the feature exists for, and it is `marketing`
  by intent in exactly the way ADR 0025 conceded the cart cookie was.

The cart cookie survived that tension **on consequence**: `marketing` is
withheld by default wherever a consent plugin is installed, so the purist
reading silently killed the cart [[Goal]] across the EU with nothing in any log
to say why. Here the consequence runs the other way. Withhold the storage and
the wheel does not stop working — it **re-rolls on every page view**, which is a
worse product than no wheel and a visibly broken one. So the field cannot be
booked `functional` on the cart cookie's argument, and booked `marketing` it
does not survive its own default.

One field, two purposes, two categories, and the stricter one wins. That is the
answer, and it does not rescue the feature.

## And the trust reading arrives where it always does

ADR 0052's third argument was *"a deadline with no consequence is just a
clock"*, and the sibling here is sharper. A wheel whose prizes are all readable
in the page dramatises a scarcity the merchant did not create — the
manufactured-urgency failure ADR 0052 refused, wearing a different hat. A
segment reading *"no luck, try again"* is worse still: a **designed loss**,
shown to somebody who has just handed over an email address.

## The decision

**Remove `popup-spin-to-win` from `locked.json`**, and record in that file that
it was withdrawn and where the argument lives — because the file is bundled
advertising, and an advertisement for a design nobody can ever be given is a
worse defect than one fewer card. The public design page at
`wconvert.io/designs/spin-to-win/` retires with it; a `preview_url` is the
whole substitute for a preview
([ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md)), and one
pointing at nothing is the dead-link failure `bin/verify-templates.php` exists
to catch on the other side of the same file.

`tests/unit/Pro/Template/ProLibraryTest.php` now asserts the whole rule rather
than six-ninths of it: **on a Pro install `TemplateLibrary::locked()` is
empty.** That is ADR 0026's *"a paying customer is never shown an upsell"* with
no remainder, and it is an assertion that fails the day a tenth card is added
without a design behind it.

## What was considered and refused

**A wheel where every segment is the same prize.** It renders, it needs no
storage, and it is a lie told with an animation — the visitor is shown an
allocation that did not happen. It is the manufactured-urgency failure with the
serial numbers filed off, and it is the one shape this decision most needs to
name, because it is the shape a later author will reach for first.

**Ship the card now, ship the design later.** That is the status quo, and it is
what the card has been doing since the library was indexed. A locked card is a
promise the paid tier keeps; this one names a promise no tier can keep, so
holding it costs the same credibility every month until it is either built or
pulled.

**A wheel that is only a picture.** A merchant who wants the *look* already has
it, and this is why nothing is lost: `popup-two-column` takes any image in its
`image` slot, including a wheel, and the copy is theirs to write. What they do
not get is an animation that pretends to decide something, which is the part
that was never ours to give.

## If it is ever reopened, start here

ADR 0052 wrote down the shape a per-visitor deadline would have to take so that
reopening it would not start from a key in `localStorage`. The same courtesy:
the outcome would live at `wcv1[optinId]` as a **fifth field beside `i`, `l`,
`d` and `c`**, holding the prize's own value and never an index into a table
somewhere else — *"store the thing, never a key pointing at it"*
(ADR 0017), and a shape change that cannot be made backward-compatible is a bump
to `wcv2` (CONTEXT.md, [[Storage Consent]]).

**That is not what is missing.** Walls 1 and 2 are unmoved by any amount of
browser storage, and wall 3 is answered against it. A reopening needs a prize
this delivery model can hand to one visitor and not to the next — which means it
starts at ADR 0003 and ADR 0025, not here.

*A `code` leaf landed in the vocabulary anyway, and it does **not** touch this.*
*[ADR 0061](0061-the-vocabulary-widens-by-what-the-library-cannot-draw.md) added
one on ADR 0025's own line about a static shared code. The distinction is
precisely the one above: a `code` node draws **one string, identical for every
visitor**, which is what this delivery model can serve — and a wheel needs a
prize it can hand to one visitor and not to the next, which it still cannot. A
design pairing the two would be a wheel again and is refused for the reason
stated here.*

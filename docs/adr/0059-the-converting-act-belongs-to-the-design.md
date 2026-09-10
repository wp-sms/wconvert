# The converting act belongs to the design, not to the Goal

A [[Goal]] declares the **counted kind**, the tier, the site dependency, the
words, and the grouping on Analytics. It no longer declares the converting act.
Which act an [[Optin]] converts on is read from the design it holds, and from
nowhere else.

`Goal::convertingAct()` is deleted. Every refusal that existed to keep a Goal
and a design agreeing about an act is deleted with it.

## The wall a merchant actually hit

Open *Browse designs* on an Optin created under *Promote a sale or offer* and
**five of seven popup designs are greyed out** — four of five inline — each
reading *"Converts on a form submission. Your goal counts click-throughs."*
**"Your goal"**, never naming which. The builder's own surface stated the Goal
nowhere: it sat one click deep behind a button labelled *Summary*.

And the merchant could not change it.
[ADR 0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md)
rule 4 says an instruction must name a door the merchant can reach, so it had
the words *"or change the Goal"* deliberately **deleted** from
`OptinController`'s refusal — because no control anywhere changed a Goal. The
Optin could neither use the design nor stop wanting it.

The escape the picker offered was worse than dead. Its all-refused note said
*"None of these counts a click-through"* and offered *Clear filters*, which
renders only when the facet toolbar does — at nine designs per [[Display Type]].
Free ships eight popup entries and six inline. There were no chips to clear, and
the door pointed at nothing.

## No competitor has this wall, and reading why is what settled it

**OptinMonster stores no goal at all.** A goal is a browse filter over the
template library and nothing more; what counts as a conversion is a per-element
**Success Action** on each button. Their own glossary defines a Conversion as
*"submitting their email address … **or** clicking on a button to be redirected
to a specific URL"* — one word, both acts. **Thrive Leads** counts both.
**OptiMonk**'s Conversion Goals are a separate tracking layer over the campaign.
**Klaviyo** treats a goal as a thinking step before anything is configured.

That is four products, none of which can express the state WConvert refused.

## The reason is a duplicate declaration, not a copy problem

WConvert declared the converting act **twice**, and the second declaration was
the Goal's:

- [`TemplateLibrary::refuse()`](../../src/Template/TemplateLibrary.php) already
  rejects any tree offering two acts or none, **at registration**. So a
  registered design offers exactly one act, and the design was already the
  enforced source of truth.
- The loader has one `convert()` callback reporting one beacon kind
  (`resources/loader/src/beacon.ts`), and there are **zero matches for `goal` in
  `resources/loader/` or `resources/renderer/`**. The runtime has always derived
  the act from the design it was handed.
- `Goal::convertingAct()` was the second declaration, and every act-shaped
  refusal in the product existed only because two sources can disagree.

Delete the duplicate and the refusals have nothing to enforce.

## It needs no schema change

`wconvert_stats` stores `kind = 'conversion'` whether the visitor submitted a
form or clicked a CTA, so **the number is already act-agnostic**; only the
*word* differed. `Goal::headlineLabel()` now delegates to
[`StatKind::label()`](../../src/Stats/StatKind.php) — **"Conversions"** /
**"Deliveries"** — which is what OptinMonster does and is never wrong for a card
holding a mix. The precise word survives per Optin, in the builder's stats
strip, derived from `template.tree`, which that screen already holds and already
walks.

Nothing stored, nothing migrated, front end untouched.
[ADR 0020](0020-conversions-are-interpreted-at-read.md)'s
interpret-at-read principle is not weakened; what moves is only where the act is
read from.

## The two refusals that survive, and why each is about something real

### 1. A Goal counting deliveries needs a capturing design

`lead_magnet_delivered` is written by
[`DeliveryCount`](../../src/Destination/LeadMagnet/DeliveryCount.php) when a
push to the lead-magnet [[Destination]] succeeds, and there is nothing to push
unless the visitor gave an address. Under a design with no `field` on it that
Goal's headline reads **zero forever** — ADR 0020's exact failure, the one that
looks broken while being right.

`Goal::needsACapture()` is the predicate, derived from `headlineKind()` rather
than listed per case, so a sixth Goal reading that kind arrives already
answered. It is **named for why, not for which case**.

The same method carries the second half of what
[ADR 0025](0025-cart-recovery-captures-nothing.md) actually argued: **a design
that captures nothing holds no Destination ids.** ADR 0025 reached that from the
click metric and it was never about the metric — a bound Destination on an Optin
with no form is configuration that can never fire, whatever counts it. Re-keyed
onto the capture, it holds under every Goal including one this install can no
longer resolve, which is the lapse a Goal-keyed check would have had
([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)).

**Never a Goal-imposed filter.** Pre-pressing a captures chip in the gallery for a Goal would
be a Goal facet in a captures chip's clothes, which
[ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md) forbids
outright — and on today's library the SMS Goal would open showing **one**
design. Which detail to ask a visitor for stays silent altogether: email against
phone is the merchant's judgement, and nothing enforces it.

As amended by
[ADR 0069](0069-the-library-helps-merchants-compare-before-applying.md), the
merchant may explicitly narrow designs by **Fill in a form / Follow a link**
or the details a form must include. These are optional capability choices; a
Goal does not preselect them, and they do not alter the compatibility checks.

### 2. An A/B arm's design converts the same way as its siblings'

**This is the guarantee the shared Goal used to smuggle in, and it would have
been lost silently.**
[`OptinRepository::createVariant()`](../../src/Optin/OptinRepository.php) copies
its parent's Goal, and its comment says exactly why: *"two arms serving
different Goals would be metered by different acts, and the rate under one would
not be the rate under the other (ADR 0020)."* That held **because** a Goal
declared an act.

Under this decision an arm is a whole Optin with its own `config`
([ADR 0045](0045-an-ab-variant-is-a-whole-optin.md)), so a merchant could give
arm A a form and arm B a click CTA — and the test would compare a ~3%
submission rate against a ~25% click rate and declare a winner. The A/B
literature names this as *the* invalid-comparison failure: define your
conversion event clearly, so you are comparing like with like.

So it is stated where it is actually true: one check keyed on the family, in
`OptinController::refuseAnArmMeteredDifferently()`, reading each sibling's act
from the sibling's own design. `OptinController::show()` resolves the same
answer as `sibling_act` so the picker can mark it **before** the click
(ADR 0042 rule 3), and a variant is born comparable because it starts as a copy
— only an edit can break it.

## And one new problem, which this decision created

Everything above removes a rule. This adds one, and it is the only place where
deleting `convertingAct()` made a *new* mistake reachable.

A Goal that counts submissions used to refuse every design offering the other
act, so **"grow my email list" over a design with no field on it was
impossible.** It is allowed now. And it is silent: the Optin saves, publishes,
shows, and honestly counts click-throughs. Nothing is broken and no number is
wrong. What is wrong is that the merchant asked for a list and will never get
one, and they find out when no [[Lead]]s arrive.

So `Goal::growsAList()` is a second predicate, and it passes the same test that
decided which of a Goal's declarations survived: **is this derivable from the
design?** The act is — two designs that differ only in a button's `action`
differ in what they count. This is not: two byte-identical trees can serve a
Goal that wants a list and a Goal that wants a click-through, and nothing in a
tree says which.

The two capture facts are **ordered rather than parallel**, and
`GoalRegistryTest` asserts the implication so they cannot drift into
contradicting each other:

| | `needsACapture()` | `growsAList()` |
|---|---|---|
| **Which Goals** | the delivery Goal | the three whose product is a contact |
| **Consequence** | refuses the save, marks the card | one sentence in the Summary |
| **Why** | the headline number is literally unreachable | the number is fine and measures something else |

It is a note and never a refusal, because refusing would put back the wall this
document removed, one predicate over. Nor does this Goal note automatically
filter the gallery, for ADR 0043's reason above. The merchant's explicit
capability filters follow ADR 0069; they do not derive from `growsAList()`.

## Two consequences accepted rather than fixed

### Switching a design reinterprets an Optin's history

Today impossible, because the swap is refused. Under this decision an Optin with
100 form conversions switched to a click design has those 100 read as
click-throughs. The **count** stays correct — a Conversion happened either way —
and this is exactly ADR 0020's interpret-at-read principle. What is new is that
it arrives through an action merchants take casually.

So the design picker marks it **on the card that would do it**, naming the
direction: *"Counts click-throughs instead of submissions — including
everything this Optin has already counted."* Marked before the click
(ADR 0042 rule 3), and carried as a `note` rather than a `reason`, because the
card can still be pressed.

*It shipped for a day as one clause appended to the dialog's header instead,
which was wrong three ways: it showed before anything was picked, it stayed up
while the merchant considered a design that changes nothing, and it could not
name a direction because it was not about any particular card. The predicate it
should have used was already written and exported beside it, with no callers.*

### A Goal card's conversion rate can blend two behaviours

Today a card is homogeneous, guaranteed by the Goal. Under this decision it can
sum a submission rate and a click rate into one figure. **Accepted.**
OptinMonster computes exactly this and calls it Conversions; the card already
lists per-Optin rows beneath it where each rate *is* homogeneous; and the
honesty is in the label being `StatKind`'s rather than a promise the Goal can no
longer keep. Splitting the card by act would invent a grouping nothing stores,
on a screen whose whole job is to group by Goal.

## What the ⇄ button-action control does now

It stays **refused**, with a corrected reason. It said *"This Optin's goal
counts form submissions, so its button has to submit the form. Change the goal
to change this"* — two false claims: a Goal counts no act, and the door named
did not exist.

What actually refuses the flip is the **step count**. A submit-metered design
has two steps because the post-submit success state is a terminal step; a
click-metered one has one (`ConvertingAct::steps()`, ADR 0025). Flipping the
`action` param alone leaves a config the save rejects whichever way it went.

Turning it on is the Success Action feature and a separate ticket: it has to add
or drop that step and carry its words, which is a document edit rather than a
param edit.

## What is not affected, checked

- **Existing installs.** This is strictly permissive: every pairing valid today
  stays valid. Pre-release anyway, so no migration.
- **The cart CTA.** `LoaderEnqueue` keys `wc_get_cart_url()` on the Goal
  deliberately (ADR 0025) and is untouched. A capture design under the cart Goal
  simply has no link button to resolve into — and it is the *"enter your email
  and we'll save your cart"* case ADR 0025 explicitly wanted routed somewhere.
  It now just works where the merchant asked for it.
- **`TemplateLibrary::refuse()`'s step-count rule.** Design-internal, unchanged,
  and now the only thing holding the act↔steps relationship.
- **Suspension, Frequency, Schedule, Targeting.** No Goal involvement.

## Consequences

- **`Goal::convertingAct()` is gone**, and with it `converting_act` on
  `GET /wconvert/v1/goals`. `needs_a_capture` and `grows_a_list` travel in its
  place — `GoalParityTest`'s *"a surface that genuinely needs to distinguish
  Goals has a field to do it with"* now names those. Both are Goal facts a
  design cannot answer, which is the whole of the test this document applied.
- **`RejectionReason::MetricMismatch` is gone**, and `PlaybookLibrary` no longer
  checks a Playbook's default Template against its Goal's act. A third party
  filing a capture design under the sale Goal is offering a start a merchant can
  legitimately want; refusing it at registration would drop the card with
  nothing in any log.
- **The Goal is on screen**, as one muted line in the builder's page-header band
  with a *Change goal* control beside it — height reserved, like the stats strip
  below it, so the registry answering does not push the tab strip down.
- **Changing a Goal confirms**, and that is not the usual confirm-everything
  reflex. The structure editor's amendment to
  [ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md) says undo
  buys a destructive action its exception — and the builder's history watches
  the design, while a Goal is a column and not part of `config`. There is no
  entry to walk back to, so the sentence is the only place it can be said:
  *"Everything this Optin has already counted is read against the goal it
  holds, so its whole history moves with it. This cannot be undone."*
- **A goal-only `PATCH` is checked against the stored design.** Both refusals
  were guarded on an incoming `config`, so `PATCH {"goal": …}` with none wrote
  any settable Goal onto any design and any binding, unchecked. It was
  unreachable from the admin — which is precisely ADR 0026's *"a screen is not
  an enforcement mechanism"* — and it matters more now that a control exists.
- **`saveOptin()` takes an optional fourth argument**, and never sends a Goal
  without the config beside it: the pair is what the server checks, and an
  ordinary Save must not re-write the Goal column.
- **The picker's all-refused note is deleted**, along with `refusesEverything()`.
  The state is unreachable and its escape was dead code.

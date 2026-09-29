# The WSMS push fills blanks and never mutates Contact state

When a pushed [[Lead]] matches an existing WSMS [[Contact]], the adapter:

- fills only fields the Contact left **empty**, never overwriting a stored value;
- **never** writes `status`, never clears a channel opt-out, never branches on
  `complained`;
- reads `id` off the matched row and ignores every other column.

A Contact it *creates* is `subscribed`, per
[#5 as amended](https://github.com/navidkashani/wconvert/issues/5). A Contact it
*matches* keeps whatever state it had.

## WSMS has two duplicate policies, and only one is a precedent

[#4](https://github.com/navidkashani/wconvert/issues/4) recorded WSMS as
fill-empty-only. That is half the picture:

- `SubscriptionHandler` **is** fill-empty-only, and says why in a comment: the
  submission is unauthenticated and matched by email *or* phone, so honouring it
  would let whoever knows one identifier clobber the other
  (`src/SubscriptionForm/SubscriptionHandler.php:157-164`).
- `CreateContactAction::handleDuplicate()` with `on_duplicate=update` is
  **incoming-wins** — `array_filter` over the caller's own config (`:171-197`).

WConvert's push shares the *first* threat model exactly: an anonymous public form
matched on one identifier. A Flow action is admin-authored with a trusted payload,
which is why incoming-wins is safe there and not here. Same codebase, different
callers, different correct answers.

## Why this is not a merchant setting

> **Narrowed by [ADR 0109](0109-integrations-share-setup-and-map-extra-answers-per-campaign.md),
> accepted but not yet implemented:** the integration plan adds a merchant choice
> for updating eligible mapped **non-identity** values on adapters with verified
> support. It does not permit overwriting email/phone identity, merging Contacts,
> changing lifecycle state or removing membership. Keep existing details is the
> default. The original argument below continues to prohibit identifier clobbering;
> it is no longer a universal prohibition on explicit custom-answer updates.
> WSMS keeps its current implementation until its safe supported fields are proven.

WSMS exposes `on_duplicate` as an enum, so mirroring it on the [[Destination]] was
available. It is the worst of the three: it turns *PII clobbering by an anonymous
attacker* into a checkbox, offered to someone who cannot be expected to model the
attack from the label. This map has refused merchant knobs on smaller stakes.

## The cost, taken deliberately

**A genuine correction never lands.** Someone fixing their own typo'd first name is
ignored, silently. That is correct at the boundary: amending a Contact's PII is a
Contact-lifecycle act, and `CONTEXT.md` already denies WConvert any opinion on
those. Where it matters, it belongs to whoever owns the Contact.

`custom_fields` is untouched for a separate reason — a canonical-key-to-custom-field
mapping is a second field map, and #4 removed the first one on purpose.

**Completed by #30: the captured name goes into `first_name`, whole and
unsplit.** WConvert's template vocabulary offers one `name` field, and WSMS
carries `first_name` and `last_name`. Splitting on a space to fill both is a
guess with no way back — "van der Berg" and "Maria Elena" file wrong in
opposite directions — and under fill-empty-only the wrong half becomes a stored
value that nothing will ever correct. So the whole name lands in `first_name`
and `last_name` is left empty, which the merchant or the person can fix in the
system that owns the Contact.

## Never writing state is free, which is why it is absolute

The expected cost of refusing to write `status` was a confused merchant: a Lead in
WConvert, a Contact in WSMS who never receives anything. **The cost does not
exist**, because WSMS gates at *send* time rather than at capture:

- `AbandonedCartService::phoneAllowed()` / `emailAllowed()` re-check
  `channel_opt_outs` on every send (`:318`, `:341`);
- `ConsentGuard` does the same (`:137`);
- campaign audiences filter `status = 'subscribed'`
  (`ContactRepository::eachKeyset()`, `:445`).

So an unsubscriber who converts on a popup is protected by whoever sends. WConvert
asserting `subscribed` would instead perform a **silent cross-plugin
resurrection** — invisible in both admin screens until a complaint arrives, and
the worst failure available in this area.

It also keeps [ADR 0007](0007-destinations-are-outbound-and-fallible.md)'s "never
reads Contact state on the capture path" *literally* true. Branching on `status` to
decide anything **is** reading it.

> **Generalised by [ADR 0049](0049-the-mailpoet-push-adds-membership-without-touching-status.md),
> which is where this stopped being a rule about WSMS.** The MailPoet push
> holds every line of the argument above and adds a scope WSMS does not have: a
> `mailpoet_subscriber_segment` row carries its own **status**, where a WSMS tag
> is an `INSERT IGNORE` with no state in it (ADR 0023). So *"list membership is
> only ever added"* had to be made literal — a row that already exists is left
> exactly as it is, whatever it says, and only a missing one is created.
>
> Two clauses above read differently once a second implementation exists.
> **"Fills blanks" is not universal**: the MailPoet push fills none, because
> MailPoet's only public update path restamps `source` and `subscribed_ip` on
> every call and WConvert has no honest IP to supply (ADR 0017). And **"never
> writes `status`" is enforced by the SHAPE of the seam** there rather than by
> the adapter remembering — `MailPoetSubscribers` can neither read a status nor
> write one, because MailPoet's obvious public method writes one on the way
> past and a rule that can be broken by reaching for the obvious call is a rule
> that will be.

## The asymmetry is the model, not an inconsistency

Creating `subscribed` is a claim about someone the owning system has never heard
of, where the form the visitor filled in is the only evidence in existence.
Matching is meeting a system that already holds an opinion about that person, and
the owner's opinion wins — including the opinion that they left.

## The both-identifiers case

One submission carrying email and phone, where the **email matches Contact A and
the phone matches Contact B**. Match order is email-then-phone, so A wins. Filling
A's empty phone then collides with `idx_phone` and throws `ConflictException`
(`ContactRepository::duplicateContact()`, `:703-715`).

**The adapter catches a conflict on `update()` and treats it as
success-with-existing** — exactly as #4 already has it doing on `create()`. First
match wins, the second identifier is dropped, and **nothing is merged.** Merging
two Contacts is a lifecycle operation and out of bounds by the same rule as the
rest of this ADR.

Match order is email-first after `SubscriptionHandler` (`:68-73`) and
`CreateContactAction` (`:118-131`). Noted honestly: `AbandonedCartService` goes
**phone-first** (`:442-447`). Two-to-one, and both *capture* paths are in the
majority.

## Consequences

- An email-only [[Optin]] and a phone-only Optin capturing one human produce two
  Leads and two Contacts, permanently. Neither system reconciles them, and
  [ADR 0021](0021-lead-identity-is-computed-not-stored.md) means WConvert cannot
  even see that they might be one.
- The visitor's response never varies on any of this — the push is queued, so at
  response time WConvert does not know what happened. See
  [ADR 0016](0016-wconvert-never-confirms-an-optin.md) for the neighbouring
  refusal.

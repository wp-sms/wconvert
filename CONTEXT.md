# WConvert — Domain Context

WConvert is a WordPress lead-capture plugin: it displays conversion campaigns
(popups, bars, slide-ins, inline forms), decides who sees them and when, and
pushes captured leads onward. It runs standalone and integrates with WP SMS
(WSMS) when present.

## Glossary

### Lead

A single capture **event** — one person submitted one form, at one time, on one
page, into one [[Optin]]. A Lead has no lifecycle: it is never "confirmed",
"unsubscribed", "bounced", or "re-engaged". It is a row in a log, not a record
under management.

"Never confirmed" is the sharpest case, because it is the one every competitor
gets wrong: **WConvert has no double opt-in and never will.** Confirming an
opt-in means reading and mutating [[Contact]] state, which the [[Destination]]
contract forbids outright. Where double opt-in is wanted it belongs to whoever
owns the Contact — WSMS's own subscription form, or the ESP's audience setting.

Not every [[Conversion]] is a Lead. An Optin whose success is a click-through
captures no form, so it produces a Conversion and no Lead.

**Leads are never deduplicated.** One person submitting two forms produces two
Leads, because they did two things. That two Leads are one person is a question
answered when the lead log is *read* — a grouping over the identifier the Leads
carry — and never a stored fact. Storing it would give a Lead a person to belong
to, and a person is the one thing that can then acquire a status: it is the same
drift as the line below, arriving by a side door that satisfies its letter.

So a Lead's headline count is submissions, and grouping is a view offered on top
of it. It is not a second number the product reports, and there is no honest
count of *people* anywhere in WConvert.

That the grouping is a *view* is also what makes it affordable to be imprecise:
it groups on the email where a Lead has one and on the phone otherwise, so a
Lead carrying only an email and a Lead carrying only a phone stay apart even
where a human knows they are one person. Under-grouping cannot produce a wrong
number when no number of people is produced at all — which is another reason
the group count must never become one.

Because identity is decided by comparing identifiers, a Lead holds its email and
phone in **canonical form** — one spelling per person, fixed at capture. An
identifier that cannot be put in canonical form is refused while the visitor is
still on the page, since the alternative is a capture that appears to succeed and
fails later where nobody is watching.

That rule is total because a Lead has **exactly one origin**: a visitor
submitting a form, in one request, on a page WConvert served. Nothing else writes
one — no admin entry screen, no CSV import, no import from another plugin. A row
arriving any other way would be asserting a capture event that never happened
here, and would carry no [[Consent Record]], which is the half that cannot be
invented.

WConvert owns Leads.

### Conversion

A visitor doing the thing an [[Optin]] exists to make them do — the countable
act its [[Goal]] names. Submitting a form is one kind of Conversion; clicking
through to an offer is another.

Every [[Lead]] is a Conversion; the reverse does not hold. Assuming it does
makes any Goal measured by clicks report zero forever.

**One Optin has exactly one converting act**, and its [[Goal]] decides which:
where the Goal is measured by submissions the form's submit is the Conversion,
and where it is measured by click-throughs the CTA is. A [[Template]] offering
both is rejected when it is registered, not disambiguated at runtime — an Optin
with two candidate Conversions has no honest number to report.

### Impression

One [[Optin]] appearing to one visitor, once.

For the three overlays this is the moment it is shown, because they render in the
top layer and being rendered *is* being on screen. For `inline` it is the moment
it enters the viewport, since an inline Optin renders where it was embedded and
may sit far below the fold. One name, two moments — a single definition would
mean different things for different [[Display Type]]s while pretending not to.

An Impression is the denominator of conversion rate, and nothing else in the
system records one, which is why it is counted rather than derived.

### Dismissal

A visitor closing an [[Optin]] **deliberately** — the close button, `Esc`, the
backdrop, or the browser's own light-dismiss.

Leaving without converting is not a Dismissal. It is not an act at all, and it is
already `impressions − conversions − dismissals`; naming it would invite a screen
that reports two numbers where one is the arithmetic of the other.

The four ways of dismissing are one thing, not four. No merchant acts differently
on "closed with Escape" than on "clicked the X".

### Contact

A person as a **managed entity**, with a consent lifecycle (opted in, opted out,
bounced, complained), list membership, tags, and segment membership.

WConvert never owns Contacts. WSMS and external ESPs (Mailchimp, EmailOctopus,
…) own them. A Lead becomes a Contact only by crossing into one of those systems
via a [[Destination]].

> **The line to hold:** a Lead is an event, a Contact is an entity. Any feature
> that wants to give a Lead a lifecycle is a signal that WConvert is drifting
> into being a second contact database.

Pushing a [[Lead]] may **create** a Contact, and may **fill in fields the Contact
left empty** — a name it never had. It never overwrites a stored value, because the
submission is anonymous and matched on one identifier, so honouring it would let
whoever knows an email rewrite the phone beside it. And it never touches lifecycle
state at all: not the subscription status, not an opt-out, not on a re-subscribe.

That asymmetry is deliberate. Creating a Contact is a claim about someone the owning
system has never heard of, where the form the visitor filled in is the only evidence
that exists. Matching one is meeting a system that already holds an opinion about that
person, and **the owner's opinion wins** — including the opinion that they left.

The counterpart is that the owning system decides at *send* time whether a Contact may
be contacted. WConvert declining to correct that state costs nothing, and asserting it
would silently revive someone who unsubscribed.

### Engagement

WSMS's term, and named here so WConvert does not reinvent it: one row per *pending
thing* about one [[Contact]] — an abandoned cart, a back-in-stock wait, a booking
reminder — carrying a status, a step counter, a next-action time and a conversion
timestamp, swept on a schedule.

An Engagement is a lifecycle per person, which is exactly what a [[Lead]] is defined
not to be. **WConvert never writes one**, and the fact that the store is polymorphic
and open to new producers does not change that: a lifecycle WConvert owns is a
lifecycle WConvert owns, wherever the row lives — and housing it in another plugin's
table only hides it from review.

Nor does WConvert read one. A [[Condition]] is evaluated in the browser, which knows
of no visitor identity, so "has an open cart" cannot be asked of a person; where
WConvert needs cart state it observes the cart itself.

### Consent Record

What the visitor agreed to at the moment they submitted — the consent text
**exactly as it was shown to them**, snapshotted onto the [[Lead]].

A snapshot rather than a pointer to the template that produced it, because the
merchant will edit that wording, and consent evidence that silently rewrites
itself to match the current copy is evidence of nothing. The Lead's `created_at`
is the consent timestamp; there is no second one.

A Consent Record is not a consent *lifecycle*. It records one act at one instant
and is never revisited — the opposite of the [[Contact]] state above, and the
reason the two must not share a word.

It also cannot be supplied by anything other than the submission that produced
it. There is no wording to snapshot for a person this system never showed
anything to, so a Consent Record is the reason a [[Lead]] cannot arrive from
outside — synthesising one is manufacturing the evidence rather than recording
it.

### Storage Consent

Permission to write to or read from the **visitor's device** — cookies,
`localStorage`, `sessionStorage`. Nothing to do with the [[Consent Record]]: this
is ePrivacy, not marketing, and it is asked of every visitor rather than captured
from one who converted.

WConvert reads it through the WP Consent API, whose five categories it adopts
verbatim rather than mapping onto names of its own. Where no consent plugin is
installed the API reports consent for everything, so an install with no such
plugin behaves exactly as it did before — a site that has made no consent
determination has none for WConvert to honour.

Every [[Trigger]] and [[Condition]] declares the category its storage falls under,
beside the tier flag on the same registry entry. Storage that records a choice
the visitor themselves made — that they dismissed this [[Optin]] — is
`functional` and never withheld, because withholding it means the popup reappears
after they closed it.

The cart cookie is the second `functional` case, and it is **booked as a
judgement call rather than an obvious reading**. It records what the visitor put
in their own cart on this site, in this session, to operate a feature of it; it
names nothing about who they are and holds a count and a total, never contents.
The case against is real — cart recovery is marketing in intent — and it loses on
consequence: `marketing` is withheld by default wherever a consent plugin is
installed, so the purist reading silently kills the cart [[Goal]] across the EU,
with nothing in any log to say why.

### Retention Period

How long the merchant keeps their [[Lead]]s before WConvert deletes them
automatically. **The default is forever, and pruning ships off.**

That default is not timidity. Deleting a merchant's Leads because the plugin
shipped an opinion is a support catastrophe, and may destroy records they are
required to keep for reasons that have nothing to do with marketing. The
pruning job exists from day one regardless and simply has nothing to do until a
period is set — so a merchant who sets one gets a job that has been running all
along, rather than a feature that arrives in a release and changes what a live
site does to their data.

It is **one setting for the whole site**, not a property of an [[Optin]]. A
Lead's retention is a data-protection decision about a person's information;
attaching it to the form that captured them would let two forms disagree about
how long the same human is kept.

Clearing it is *keep forever*, never *keep zero days*. The two readings differ
by the whole log.

A Retention Period is disclosed: the privacy-policy text WConvert registers
states the configured period, so setting one writes the merchant's disclosure
for them.

### Optin

The unit of work in WConvert: one designed thing, shown to a chosen audience,
under a set of display rules, serving one [[Goal]], pushing to one or more
[[Destination]]s.

> **Why not "Campaign":** WSMS already has a `Campaign` — a throttled batch
> outbound send with an audience resolver, quiet-hours guard, and recurrence.
> Both plugins share one wp-admin, so one word for two meanings would leak into
> docs, support tickets, and REST routes. `Campaign` stays batch-send; WConvert
> uses `Optin`.

### Display Type

*How* an Optin appears: `popup`, `floating_bar`, `slide_in`, or `inline`.

Display Type is **not** the primary axis of the product. Users arrive via a
[[Goal]], and the type is prefilled by the chosen [[Playbook]] — selectable as
an override and a filter, never the first question asked.

Three of the four are **overlays** — `popup`, `floating_bar`, `slide_in` — which
compete for the visitor's screen, so at most one is shown per page view.
`inline` is not an overlay: it renders where it was embedded and never competes.

### Targeting

*Where* an [[Optin]] is allowed to appear: the set of pages it may show on, as
an include list and an exclude list, with exclude winning.

Targeting is the one part of an Optin's rules evaluated on the **server**, at
asset-enqueue time — so it never reaches the browser, and an Optin that does not
match the current page costs the page nothing. Every other rule is a
[[Trigger]] or a [[Condition]] and is evaluated client-side.

Five page rules — `post`, `singular`, `archive`, `term`, `url` — plus one
visitor predicate, `logged_in`, which lives on this axis **only** because the
client cannot read WordPress's HttpOnly auth cookie. The two are held apart in
storage: the lists are a union of page sets, so a visitor rule dropped into an
include list would widen the Optin to the whole site rather than narrow it.

`term` is one rule covering both places a term puts itself on a page — the
term's own archive, and a singular post carrying it. A merchant choosing "News"
means both, and splitting that into two rule types makes the obvious choice the
wrong one half the time.

An **empty include list is "everywhere"**, not "nowhere". It is the only
reading under which an exclude-only Optin — everywhere except the checkout —
means anything.

> **Why not "Placement":** in adtech that means position on the page, which is
> what [[Display Type]] already covers. **Why not "Audience":** WSMS's
> `Campaign` has an audience resolver, and both plugins share one wp-admin.

### Trigger

*When* an [[Optin]] fires — time on page, scroll depth, exit intent.

An Optin fires when **any one** of its Triggers fires. Every Optin has at least
one; "shows immediately" is the explicit `page_load` Trigger, never an empty
list.

### Condition

*Whether* a visitor is eligible to see an [[Optin]] — device, referrer, cart
state, time of day.

**All** Conditions must hold at the instant a [[Trigger]] fires. They are not
evaluated ahead of time and held: an Optin whose cart emptied while its ten
second timer ran does not show.

> **The distinction is load-bearing and fixed per rule.** A rule type is a
> Trigger or a Condition, never both — `scroll_depth` means "when they reach
> half way", and there is no second spelling meaning "if they already had".
> Without the split, an engine holding several eligible Optins cannot tell
> "waiting" from "ineligible".

### Goal

The outcome an Optin exists to produce, chosen *before* anything else is
configured, and **kept** on the Optin for its whole life.

A Goal is first-class, not a setup-wizard answer that evaporates: it sets the
Optin's headline success metric, decides what the analytics screen reports, and
is the seam where later versions can recommend improvements.

Each Goal **declares the metric that counts it** — which [[Conversion]] is the
one that matters, and whether that Conversion is a [[Lead]] or not. That
declaration is what makes a Goal more than a filter at creation time.

The declaration is applied when the analytics screen is *read*, never stamped on
each Conversion as it happens. So correcting a Goal restates the Optin's whole
history rather than splitting it at the moment of the edit — which is what makes
"persistent, not frozen" below safe to mean literally.

"Kept for its whole life" means persistent, not frozen: a Goal never evaporates
off the Optin, but it can be corrected.

> **The test a Goal must pass:** it names an outcome WConvert can *count*.
> "Grow my email list" is countable. "Increase brand awareness" is not, and a
> Goal that cannot be counted is decoration — it collapses Goal back into a
> disposable onboarding answer.

### Template

The design of an [[Optin]] — its structure and its look, with no words in it.

A Template declares which slots exist (a heading, an image, fields, a button), how
they are arranged, and how they are styled. It does **not** carry copy: the words
come from the [[Playbook]] that prefilled the Optin, or from the user. Whatever
placeholder text a Template carries exists so the gallery has something to show, and
is never copied into an Optin.

> **That boundary is what keeps the library small.** Copy is what makes an Optin
> serve a particular [[Goal]], so with the copy held elsewhere a Template is
> **goal-agnostic** — the library is a set of designs per [[Display Type]], not a
> design for every pairing of Display Type and Goal.

One Template serves exactly one Display Type. An Optin **takes a copy** of its
Template rather than a link to it, so improving a Template never restyles an Optin
already running on it.

A Template declares its slots as [[Slot Role]]s, which is what lets a [[Playbook]]
carry copy without being bound to one design.

A slot may be **hidden** rather than removed. The settings panel edits tokens,
slot content and slot visibility and never *arrangement*, so hiding is how a
merchant drops a slot they do not want — which keeps the vocabulary the ceiling
on design variety, and keeps a canvas landing later as an editor over a tree
that already exists. Hiding is offered only where the design survives it: not
the button that converts, and not a field, because an Optin with no countable
act and a form that captures nothing are both refused elsewhere. It is also how
consent capture is off by default and one click from on — every capture design
ships the `consent` node hidden.

### Playbook

A ready-to-run bundle serving one [[Goal]] — a [[Template]], copy, a
[[Display Type]], display rules and destination hints, packaged with notes on why
it works. One Goal has many Playbooks.

A Playbook is **data, not code**: a registry entry, so third parties can add them
and the library can update independently of a plugin release. It carries **no
markup** — copy is plain text, and the one case needing a link inside a sentence
expresses it as structure.

Picking a Playbook **prefills a new Optin by snapshot**: its values are copied
into the Optin and the two never speak again. Improving a Playbook never rewrites
the words on a running Optin, and deleting one leaves every Optin it started
untouched — so `playbook_id` is *provenance*, exactly as `template_id` is.

> **Provenance is not performance.** Two Optins from one Playbook may have been
> edited into unrecognisably different things, so rolling their [[Conversion]]s up
> measures the edits, not the Playbook. The metric is "Optins started from this
> Playbook", never "this Playbook's conversion rate".

Because copy is snapshotted separately from design, a Playbook keys its words to
[[Slot Role]]s rather than to one Template's structure — so the words survive
switching Template, and a Playbook is not married to a single design.

A Playbook cannot name anything that only exists on a particular site: no post or
term ids in its targeting, no [[Destination]] ids, and no privacy-policy link —
the consent *wording* is generic copy a Playbook supplies like any other, but the
link is resolved by the renderer from the site's own configured policy, so it is
correct everywhere without any Playbook knowing where it is. Which is total for
links rather than a rule about one of them: **a Playbook's copy carries a link
label and never an `href` at all**, because a destination is a page on one
particular site and a link with a label and no destination is precisely how a
generic entry asks the site for the one it cannot know. A destination hint names
Destination *types* and the [[Lead]] fields the Playbook needs, and prefill never
binds a Destination invisibly — which is a rule about the *values* as much as the
shape, since a Destination id is most likely to arrive dressed as a type. The
hint is also authoring state and never reaches the browser: nothing that renders
an Optin reads it, and the payload is inlined into every matching page.

**Degradation is visible, and it applies to rules — not to shape.** A Playbook
wanting a feature the install lacks substitutes the best available rule and says
so, rather than blocking; the premium seam is an explanation, not a wall. A
[[Trigger]] is substituted, because an Optin with none can never fire. A
[[Condition]] is dropped, because there is no honest substitute for one and
inventing it fabricates targeting nobody asked for. A Playbook whose *Display
Type* is unavailable does not degrade at all — it is shown as an upsell, since a
floating bar reshaped into a popup is a different design badly made.

A Playbook whose requirements are simply **absent from the site** — a
cart-abandonment Playbook with no store — is hidden rather than degraded. You can
buy a licence from us; you cannot buy WooCommerce from us.

### Slot Role

The semantic name of a slot in a [[Template]] — `headline`, `cta_label`,
`fine_print`, `consent_text`, `success_headline` — drawn from a closed vocabulary
and unique across the Template's whole tree.

Slot Roles are the seam between the two halves of a designed Optin: a Template
declares which Roles it offers, a [[Playbook]] supplies copy against them, and
neither needs to know the other's internals. A Role a Template does not declare is
dropped when a Playbook prefills it — a case prevented at authoring time, since a
Playbook's default Template is validated to declare every Role it fills.

A field's Roles are **derived rather than declared**: they are named for what it
captures, so a `field` capturing an email offers `email_label` and
`email_placeholder` and cannot offer the phone's. That is why a field node carries
no Role of its own while six of the vocabulary's Roles are named for fields, and
it is what makes the field kind part of the *design* — a Template capturing an
email cannot serve the SMS [[Goal]] however its words read.

### Destination

A configured endpoint a captured [[Lead]] is pushed to — WSMS, an email service
provider, a webhook, or the lead-magnet delivery email.

A Destination is **outbound and fallible**: it is configured, it is optional, it
can be one of several, and it can fail without the capture failing. Anything that
is none of those is not a Destination — so **the local Lead log is not one**. The
log is where a Lead is *stored*: written first and always, not configurable, not
optional, and if it fails the capture itself failed. Naming it a Destination
would put a member in the set that satisfies none of the set's invariants.

Destinations are the only way a Lead is pushed out of WConvert **automatically**.
CSV export is a manual admin action, not a Destination.

A Destination is configured once, site-wide, and *includes whatever selects the
target inside the remote system* — the Mailchimp audience, the WSMS tag. Whatever
that selector is, it is only ever **added**: a Lead arriving cannot remove the
audience or tag membership a [[Contact]] already has, because that membership is a
decision the owning system made and WConvert has no standing to revise. An
[[Optin]] holds Destination ids and nothing more, so two Optins feeding one
audience reference one Destination. Where several Destinations share credentials,
those live on a [[Connection]] underneath them.

Data flow through a Destination is **one-way at capture time**: WConvert →
Destination. WConvert never reads [[Contact]] state back — not subscription
status, list membership, or suppression — so it never has an opinion about who is
subscribed, and it reads nothing at all on the capture path. Admin-time metadata
reads are permitted and expected: listing a provider's audiences or custom fields
to populate the configuration UI, and testing a connection. Those are reads of
the provider's *shape*, never of a person's state.

### Connection

Stored credentials for one remote account — a Mailchimp API key, a Brevo key. One
Connection backs one or more [[Destination]]s, so two Mailchimp audiences are two
Destinations over one Connection and the merchant pastes the key once.

Not every Destination has one. A webhook's URL is its whole configuration, and
the lead-magnet delivery email and the WSMS push authenticate against nothing.

### Standalone

WConvert running with no [[Destination]] that depends on another system — no
WSMS, no email service provider, no webhook. Capture works, [[Lead]]s are
recorded, CSV export works, and the lead-magnet delivery email still sends,
because none of that leaves the WordPress install.

This must be a fully working install. WSMS is never a runtime requirement of the
capture path.

A Standalone install has no double opt-in — not as a gap, but because nothing in
it ever sends marketing to a [[Lead]]. The log is a log. The one thing that does
send, the lead-magnet delivery email, fulfils a request the visitor made seconds
earlier.

### Pro

The separately-distributed add-on plugin, installed **alongside** the free plugin
rather than replacing it. Pro does not *unlock* premium features — it **supplies**
them. The code for exit intent, A/B testing, `floating_bar`, `slide_in` and the ESP
[[Destination]]s exists only inside Pro, and a free install has never contained it.

A licence buys **updates and support, never the features themselves**. An expired
licence stops the updater; it does not change what a running site does.

> Counterpart to [[Standalone]]: both name an install shape by what is *absent*, and
> both must be a fully working install. A free install is not a crippled Pro install —
> it is the whole product minus features it never carried.

### Availability

Whether a member of a registry — a [[Trigger]] or [[Condition]] type, a
[[Display Type]], a [[Template]], a [[Destination]] type, a [[Goal]] — can be used on
this install right now. Three states, and the distinction between the last two is
load-bearing:

- **`ready`** — present and usable.
- **`locked`** — absent because the install does not have [[Pro]]. Buyable from us.
- **`unavailable`** — absent because something the *site* would need is missing: no
  WooCommerce, no WSMS. Not buyable from us.

Where both reasons apply at once, **`unavailable` wins** — a merchant with no store is
never sold Pro for a feature Pro would not give them either.

> **A paying customer is never shown an upsell.** Collapsing `locked` and
> `unavailable` into a single "not available" is exactly what breaks that — it shows a
> Pro customer an advertisement for Pro, and it offers to sell a merchant a WooCommerce
> licence we do not have.

The three states name **why** a member is absent. **How** that absence renders is a
property of the surface, and **no surface ever renders `unavailable` as an upsell**. A
list the merchant went hunting through explains the gap, because silence there is
baffling. An entry point into a creation flow **hides** it, because explaining a
WooCommerce feature to someone with no store is noise rather than honesty — which is
why a cart-abandonment [[Playbook]] is hidden on a store-less site, and why the Goal
above it is too.

Availability is a property of the registry member, declared as data beside it. There is
no separate list of premium capabilities to keep in step.

### Suspended

An [[Optin]] that exists and is published but is **not shown**, because a rule it
depends on is no longer available on this install — [[Pro]] was deactivated, or
WooCommerce was.

Not a state the merchant chose, which is what separates it from a draft or a paused
Optin, and the reason it is always displayed with its cause.

Suspension exists because dropping an unavailable [[Condition]] is only safe while the
Optin's *words* do not depend on it. Widening the audience for a `device` rule is a
softer targeting decision; widening it for a cart rule makes the Optin say *"you left 3
items in your cart"* to someone who has never added anything. A Condition whose
guarantee the copy asserts is **load-bearing**, and an Optin holding an unavailable one
is suspended rather than degraded.

The other way in is a [[Trigger]] with no honest substitute. A premium Trigger is
normally substituted, because an Optin with none can never fire — but `click_element`
names a selector only one site has, so there is nothing to put in its place. It is
dropped like any other, and an Optin that loses its **last** Trigger that way is
suspended rather than left running and unable to fire. Both roads lead here for the
same reason: suspension is what a silent failure looks like once it has a cause the
merchant can read.

A suspended Optin **emits nothing** — no [[Impression]], no [[Conversion]] — so its
history stays comparable rather than filling with zeroes against a live denominator.
It resumes on its own when the dependency returns; nothing about it is destroyed, so
there is never a repair step.

## Boundary with WSMS

WSMS already owns contacts, lists, tags, segments, subscription forms, ESP
integrations, campaigns (batch sends), and a flow engine. WConvert deliberately
owns none of these.

WConvert owns what WSMS lacks: the **display layer** — what to show, to whom,
when, and where — plus the conversion analytics of that display.

When both plugins are active:

- WConvert registers itself with WSMS's `ExtensionRegistry` for discovery and
  admin presence.
- WConvert pushes Leads to WSMS as a Destination.
- WSMS never calls into WConvert, and WConvert degrades cleanly to Standalone if
  WSMS is deactivated.

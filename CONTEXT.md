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

**All of free's per-visitor state lives in one key**, and it is worth knowing
its name because three documents once described storage WConvert does not have.
`localStorage['wcv1']` holds a map of [[Optin]] id to that Optin's record —
impressions, the day of the last one, dismissed, converted — written through a
`localStorage → cookie → in-memory` ladder that fails open
(`resources/loader/src/state.ts`). There is no key per Optin and no second key:
a new kind of per-visitor fact is a reserved slot or a new field inside `wcv1`.

The first such slot is `site`, which holds the site-wide [[Frequency]] — the
same four fields, once for the whole site. It is `functional` for the reason
every other field in this key is, and it is **written only where the merchant
has configured a site-wide allowance**, so an install that has asked for nothing
stores exactly what it stored before the feature existed. `site` is lower case
and four characters, so no ULID can take it (ADR 0047).

**The `1` is a version, and it is an escape hatch the server side does not
have.** A shape change that cannot be made backward-compatible is a bump to
`wcv2`: old records are abandoned rather than migrated, every visitor looks new
once, and for a frequency cap that is an acceptable price. Nothing equivalent
exists for the three tables, the nine options or the published set, which is
why browser storage is the least urgent of WConvert's four storage layers.

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

An Optin is never hard-deleted. Its counters reference it by id, so a removed row
would make every count naming it uninterpretable — which is also why ending an
A/B test cannot delete the losing [[Variant]].

### Variant

One arm of an A/B test — **and a whole [[Optin]]**, not a shape inside one. It
has its own id, its own row, and therefore its own counters, because
`wconvert_stats` is keyed by `optin_id` and that key is what makes the counter
upsert atomic. Two designs behind one id could not be told apart, which is the
entire point of the test.

A Variant names its parent in `wconvert_optins.parent_id`. It is *provenance*,
the way `template_id` and `playbook_id` are — and unlike those two it is a
column, because the Optins list has to FILTER on it and that list reads neither
LONGTEXT column by design (ADR 0001). The list shows parentless Optins only and
nests each test's arms beneath their parent, so a merchant sees one campaign
with two arms rather than two campaigns. That is a query condition; storage does
not constrain the screen, it just has to be able to express it.

Ending a test **never deletes the loser**: the arm that lost is a month of the
merchant's own history, and an Optin is never hard-deleted anyway. Ending one
is the merchant's decision and never an automatic one — the counters are daily
totals and the denominator is browsers, so there is no significance WConvert
could honestly compute. The winner **becomes the campaign**: its `parent_id`
goes to `NULL` and it takes the parent's name, and nothing is copied onto
anything, so every row's counters keep meaning exactly one design. There is no
*finished* flag either — a test is running exactly while a parentless Optin has
published arms beneath it.

Which arm a browser draws is held as `v` on the parent's own client record —
`wcv1[parentId].v` — beside the impressions and dismissals already there. It is
the arm's **index**, drawn evenly across the published arms the first time this
browser meets the test, and there is no ratio to set. So the split unit is
**the browser record, not the person**: one visitor on two devices can meet both
arms and be counted twice. That is the same limit [[Impression]] and
[[Conversion]] already carry, for the same reason, and it is why there is no
honest count of people anywhere in WConvert — the Optins list says so where it
reports the two numbers.

A Variant is [[Pro]]'s, at the `pro` rung. See
[ADR 0045](docs/adr/0045-an-ab-variant-is-a-whole-optin.md) for the shape and
[ADR 0058](docs/adr/0058-a-test-ends-when-the-merchant-says-so.md) for how a
test runs and ends.

### Frequency

The allowance — how often this device may be shown something — checked before any
[[Trigger]] or [[Condition]] is evaluated. Four fields: a maximum number of
impressions, a cooldown in days, stop after a [[Dismissal]], and stop after a
[[Conversion]].

It has **two scopes and one shape**. Per [[Optin]], the two switches default *on*
and the two numbers *off*, because a visitor who closed something said stop
showing me *this*. Site-wide, the same four fields are held once for the whole
site and **all of them default off**, because reading one dismissal as "show me
nothing anywhere for a week" is a claim about what the visitor meant that they
did not make.

Site scope is a **veto**, checked first: an Optin cannot opt out of it, since a
per-Optin *ignore the site setting* is the configuration having two scopes exists
to delete. A visitor stopped by either scope is `capped` — the standing
`resources/loader/src/decide.ts` already gives an Optin whose allowance is spent
and cannot change on this page view — and never a seventh word.

Frequency is not a [[Trigger]] or a [[Condition]]: it is not a question about
this page view, it is what this device has already been shown. Nor is it a
[[Schedule]]: that is when the campaign is on at all, is a fact about the Optin
rather than about this device, and is checked immediately beside this one for
the same reason — both are asked before any rule. See
[ADR 0047](docs/adr/0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md).

**Only what differs from the engine's defaults is ever stored.** Both switches
default *on* per Optin and the loader tests `!== false`, so a stored `true` is
bytes on every matching page view that cannot change an answer — the payload is
inlined into every page an Optin matches. `src/Optin/Frequency.php` is the one
place that arithmetic lives, and it is the shape the site-wide scope reuses.

> **That sentence is about the PAYLOAD, and the site scope is where the two come
> apart.** To the engine an absent switch is *on*; to the site scope an absent
> switch is *off*. So the site's WordPress option
> (`src/Optin/SiteFrequency.php`) spells both switches out in full — an option
> written the payload's way would lose a switch the merchant had just turned on
> — while what reaches the browser still never carries a `true`. One reading of
> absence per side of the wire, and one place that decides it.

### Schedule

*When* an [[Optin]] runs at all — a start, an end, both, or neither. Beside
[[Frequency]] and checked in the same place, because the allowance is how often
**one visitor** may meet a campaign and this is when the campaign is on.

**The word means two different things on either side of one boundary, and that
is why it is in the glossary.** The merchant authors a **local wall time**
(`2026-11-27 09:00`, with no zone on it), because that is the only thing they
can reason about, and that is what `config` stores. What the browser receives is
**one absolute instant in milliseconds**, resolved once by the server against
`wp_timezone()`. The loader compares it to `Date.now()` and does no timezone
arithmetic — the visitor's clock is not the site's clock, and a schedule that
means different things in different browsers is not a schedule.
`src/Optin/Schedule.php` is the one converter between the two, and because the
wall time is what is stored, **correcting the site's timezone corrects every
schedule with it** on the next rebuild of the published set.

A scheduled Optin is **in the published set on both sides of its window**. That
is the counter-intuitive half: the set is rebuilt on write and never on a timer,
so an Optin held back from it would never reach a cached page at the moment its
window opened, and a page cached while a window was open needs the fact in hand
to work out for itself that the window has shut. It leaves the set when the
merchant unpublishes it.

Outside its window an Optin shows nothing and records **no [[Impression]]** —
no row, never a zero-valued one, for the reading [[Suspended]] already gets. Its
standing is `capped`, the word an Optin whose allowance is spent already has,
and the eligibility inspector says *"Scheduled. It starts in 3 days."* beside
it rather than minting a seventh one.

A start with no end and an end with no start are both valid. An end at or before
its start is not, and is refused by the normaliser rather than by any one
screen. See [ADR 0050](docs/adr/0050-a-scheduled-optin-stays-in-the-published-set.md).

> **A Schedule is not the `time_of_day` [[Condition]], and the two are worth
> reading together.** A Schedule is a campaign's **lifetime**: two instants,
> each happening at most once, resolved on the server and compared to
> `Date.now()`. `time_of_day` is an **eligibility window that comes round again
> every day** — *only during opening hours* — so there is no finite set of
> instants to resolve and the offset a zone is on moves twice a year. What
> travels for it is therefore the **zone** rather than an instant, on the
> payload tag, and the browser's own tzdata answers: a page cached before a
> daylight-saving transition is still right after one.
>
> Both are the site's clock and never the visitor's, which is the half they
> share. Where they differ is *when the arithmetic happens* — once at publish,
> or on every evaluation — and that follows entirely from one of them
> repeating.

**A `countdown` in a [[Template]] counts to `ends_at` and to nothing else**, so
there is only ever one deadline and no way for a timer to disagree with the
schedule it is counting to. The instant the loader compares against is the one
the projection already resolved, which makes the display cache-proof for free —
and at `ends_at` the Optin leaves its window, so the deadline has a real
consequence rather than being a clock that runs out beside an offer that does
not. An evergreen per-visitor countdown is **refused** rather than deferred: it
is a manufactured time limit under WCAG SC 2.2.1, which is Level A. See
[ADR 0052](docs/adr/0052-a-countdown-counts-to-the-optins-own-schedule-end.md).

### Display Type

*How* an Optin appears: `popup`, `floating_bar`, `slide_in`, or `inline`.

Display Type is **not** the primary axis of the product. Users arrive via a
[[Goal]], and the type is prefilled by the chosen [[Playbook]] — selectable as
an override and a filter, never the first question asked.

Three of the four are **overlays** — `popup`, `floating_bar`, `slide_in` — which
compete for the visitor's screen, so at most one is shown per page view.
`inline` is not an overlay: it renders where it was embedded and never competes.

**The four are a closed set in PHP** (`src/Optin/DisplayType.php`), enforced on
the way in like every other closed vocabulary, and `popup` is what absence means
on both sides — the renderer mounts an entry with no Display Type as a popup and
the loader reads anything that is not `inline` as an overlay. So a value nothing
recognises is dropped at the write rather than shipped to a page that cannot
place it. Two of the four are [[Pro]]'s in practice, but the enum says nothing
about tier: a free install simply has no floating-bar or slide-in design to
name.

### Anchor

Where an `inline` [[Optin]] was put — one empty element carrying one attribute
and the Optin's id, and **the whole contract between authoring and rendering**.

`inline` is the one [[Display Type]] that is not an overlay: it renders where
it was embedded and never competes for the screen, which is why it alone needs
somewhere on the page to go while the other three mount themselves. So the two
ways a merchant places one — a Gutenberg block and a shortcode — do not differ
in what they emit. They differ only in where a merchant is standing when they
write it.

Keeping the surface at one attribute is what makes a third authoring surface —
a page builder module, a `do_shortcode()` in a theme template — a one-liner
rather than a fourth implementation. It carries no class and no wrapper:
everything visible is the renderer's, inside a closed shadow root the loader
mounts into this element.

**An Anchor is not a promise that anything renders.** An Optin may be
unpublished, soft-deleted, [[Suspended]], switched to another Display Type, or
simply not targeted at this page, and every one of those leaves the Anchor
sitting in post content nobody has edited. The loader walks the payload looking
for Anchors and never the reverse, so one with no entry is never looked at: it
renders nothing and records no [[Impression]], which is the safe direction —
an Optin nobody saw has not been seen. Two Anchors for one Optin on one page
are one Impression for the same reason.

Where an unresolvable id is *reported* is the block editor, which is the
surface that can ask. Neither authoring surface validates against the published
set, because staying exactly as clever as each other is what makes them
substitutable.

### Targeting

*Where* an [[Optin]] is allowed to appear: the set of pages it may show on, as
an include list and an exclude list, with exclude winning.

Targeting is the one part of an Optin's rules evaluated on the **server**, at
asset-enqueue time — so it never reaches the browser, and an Optin that does not
match the current page costs the page nothing. Every other rule is a
[[Trigger]] or a [[Condition]] and is evaluated client-side.

Five page rules — `post`, `singular`, `archive`, `term`, `url` — plus **two**
visitor predicates, `logged_in` and `role`, which live on this axis **only**
because the client cannot read WordPress's HttpOnly auth cookie. The two kinds
are held apart in storage: the lists are a union of page sets, so a visitor rule
dropped into an include list would widen the Optin to the whole site rather than
narrow it.

Each visitor predicate is its own **field** on `Targeting`, and that is the
whole of holding them apart. `TargetingType` enumerates the page rules and
nothing else, so there is no way to build a visitor rule inside a list at all —
which matters because that failure is silent: a *"subscribers only, on the
pricing page"* Optin dropped into the include list shows to every subscriber on
every page, and nothing anywhere says so.

`role` is **one predicate over several systems**, not one per system. WordPress
roles are one answer to *what is this visitor*; a membership level, a plan or an
enrolment is the same question asked of another plugin. So the merchant sees one
control listing everything their site can tell them apart by, and an adapter
implements `RoleSource` and registers with `RoleRegistry` — no rule type is
added, no manifest entry, no evaluator. Holding **any one** of the chosen roles
is enough, because the real OR cases are one rule carrying several values
(ADR 0005), and an emptied set is *any role* rather than *nobody*.

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

**`page_load` is not one Trigger among many — it is the absence of a wait, and
it subsumes every other Trigger on the Optin.** Its evaluator holds constantly,
and Triggers are ORed, so an Optin carrying it fires the instant its
[[Condition]]s hold and no other Trigger can ever be the reason it fired.
*"Shows immediately AND after a few seconds"* is therefore not a preference, it
is a mistake: the seconds decide nothing.

That generalises within a type, and only within one. **Across** types which
fires first is a fact about one visitor — whether they scroll past half way
before eight seconds elapse is not knowable here — so two different types are a
real choice. Within one type it is decidable: a threshold is crossed once and
the lowest wins, so *"after 8 seconds or after 20 seconds"* is *"after 8
seconds"*; and a Trigger with no params has one spelling, so a second is the
same rule.

**So a rule type is offered once**, and the exception is a type whose params
say WHICH thing rather than how much: two `click_element`s are two selectors
and two `query_param`s are two parameters, both real. Everything else — two
thresholds, two of a type with no params — is one rule written twice, and the
merchant is not offered the mistake rather than being told about it after they
make it. A pair already stored is still shown, with a note, because a rule in
`config` with nothing on screen to act on is worse than a rule that reads
oddly.

The mirror holds on the [[Condition]] axis and the trap there is sharper: they
are ANDed, so a second of a kind NARROWS the first — `device [mobile]` beside
`device [desktop]` holds for nobody. One rule carrying several values is what
that merchant meant, which is what a set-valued scalar is for (ADR 0005).

So the authoring surface asks **whether it waits** before it asks what for, and
the two answers are `page_load` and a list. The model is unchanged — still one
flat, ORed axis — and an Optin that already carries both still shows every rule
it has, each saying that it never runs. Hiding one would be a rule still in
`config`, still saved back, with nothing on screen to act on.

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

> **Amended: the library is no longer small, and the boundary is what stops the
> matrix coming back.** It is twelve designs and growing, and what keeps that
> from becoming Display Type × Goal is that a Template still carries no words —
> so every facet the picker filters by describes the **design** (how it is
> arranged, what it captures, whether it has a picture) and never the Goal. That
> is also why there is no Industry or Season facet: those work for a library
> whose entries contain a photograph of a bakery, and these contain no words at
> all. See
> [ADR 0043](docs/adr/0043-the-library-is-indexed-and-its-facets-are-derived.md).

A design a free install did not get is still advertised — a card with a name,
its facets and a link to a live preview, and no tree
([[Availability]], `locked`). **So a card is an advertisement, and an
advertisement for a design nobody can be given is a worse defect than one fewer
design.** It is the same rule as *a paying customer is never shown an upsell*,
one step earlier: that one is about who sees the card, this one is about whether
the thing behind it can exist at all. A card is withdrawn rather than left
standing while somebody works out how to build it — which is what happened to
the prize wheel, whose per-visitor outcome no cached page can carry
([ADR 0053](docs/adr/0053-the-spin-to-win-card-is-withdrawn.md)).

One Template serves exactly one Display Type. An Optin **takes a copy** of its
Template rather than a link to it, so improving a Template never restyles an Optin
already running on it.

> **A stored tree carries a version, and it is there for the day the vocabulary
> narrows.** The copy an Optin holds is as old as the Optin and the code reading
> it is as new as the release, which is safe in exactly one direction: adding a
> node type or a token is invisible to an old design, while renaming one or
> tightening a choice list would silently rewrite designs already running. So
> every tree this plugin builds is stamped `v` — the same escape hatch the
> browser record's `wcv1` has and the server side did not, which
> [[Storage Consent]] already says out loud. Nothing reads it yet; the first
> reader is whichever release first has to narrow something. See
> `WConvert\Template\TemplateTree::VERSION`.

A Template declares its slots as [[Slot Role]]s, which is what lets a [[Playbook]]
carry copy without being bound to one design.

A slot may be **hidden** rather than removed. Hiding is how a merchant drops a
slot they do not want — which keeps the vocabulary the ceiling on design
variety, and keeps a canvas landing later as an editor over a tree that already
exists. Hiding is offered only where the design survives it: not the button that
converts, and not a field, because an Optin with no countable act and a form
that captures nothing are both refused elsewhere. It is also how consent capture
is off by default and one click from on ([ADR 0032](docs/adr/0032-consent-capture-is-first-class-in-the-template.md))
— every capture design ships the `consent` node hidden.

> **Corrected.** This paragraph opened *"The settings panel edits tokens, slot
> content and slot visibility and never* arrangement*"*, and both halves of that
> stopped being true at the Content/Structure merge: `SettingsPanel` no longer
> exists, and one surface — the **Content** tab, a block tree with an inspector
> beside it — now edits words **and** arrangement, with an ↑, a ↓ and a Delete
> on every row. Four ADRs were amended in that work and the glossary was not.
>
> What is corrected is only the clause naming a component and a limit that both
> went. **The vocabulary is still the ceiling** — a merchant may only add what
> `manifest.json` declares, and [ADR 0010](docs/adr/0010-templates-are-configuration-not-documents.md)
> is untouched on that. Every other sentence above stands as written.

**And the manifest is the ceiling on how well a value can be *edited*, not only
on what may exist** — a token declaring no `choices` whose value no shape test
reads arrives in the panel wearing a raw text box, so where a shape cannot be
inferred the manifest enumerates it
([ADR 0054](docs/adr/0054-every-control-has-the-shape-of-its-value.md)).

### Starting point

A named set of display rules a merchant can begin from — *"Once they have read a
while"*, *"Only on blog posts"*, *"Rescue an abandoned cart"* — offered in the
rules panel and applied with one click.

**It is not a preset, and the word is the decision.** *Preset* already means a
per-type shortcut over one rule's general form: `time_on_page {seconds: 5}` is
"after a few seconds", and that is what `RulePreset` and `RuleLabels::presets()`
name. Both would be on this screen at once, since a Starting point that lands
"after a few seconds" is a bundle whose content is a preset. Two meanings of one
word on one screen is what this glossary exists to prevent.

A Starting point **names sections and replaces only the ones it names**. The
rules panel is four sections — Where, When, Who, How often — and one carrying
Conditions leaves the merchant's [[Trigger]]s alone: an [[Optin]] with no Trigger
can never fire and the save route refuses one, so a button that wiped them would
break the Optin it was offered to improve. Which sections it names is readable
off what it carries, and applying one **confirms first**, because the builder's
history watches the design and rules are not undoable.

Like a [[Playbook]] it is bundled PHP returning an array — `wp i18n make-pot`
cannot see a string in JSON — and like a Playbook it may not name anything only
one site has: no post ids, no CSS selectors, no cart totals in the store's own
currency. **Unlike** a Playbook it touches no copy and no [[Template]]: applying
one changes rules and nothing else, because there is no reading under which
"start from this" means "replace my headline".

Its [[Availability]] is the least of its rules', so a site with no store is never
offered one that would [[Suspend]] the Optin on the spot.

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

The words are the Playbook's mechanism and not the whole of what survives. Two
things a *merchant* supplies are content without being words — an `image`'s
`src` and `alt`, and a `button`'s `href` — so no Role binds to them and nothing
carried them across a switch. `MerchantsOwn` carries what the merchant
**changed**, measured against the entry their copy was taken for, and leaves the
new design's own asset standing where they changed nothing.

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
hint is also authoring state and never reaches the **visitor's** browser:
nothing that renders an Optin reads it, and the payload is inlined into every
matching page.

> **Corrected: "never reaches the browser" was too strong, and it had made the
> hint unreadable by anything at all.** `PublishedProjection` strips it from
> what the site serves and always will — that is the half that matters — but the
> admin is a browser too, and for as long as the sentence read as written the
> hint was written by prefill on every Playbook-started Optin and opened by
> nothing. It is read now on the **Destinations tab of the builder**, where the
> decision it is about is made: it names the types this install can name and the
> fields the Playbook needs, and it is shown only while no Destination is bound,
> because once one is what the Playbook wanted is history.

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
and ~~unique across the Template's whole tree~~ **claimable by more than one node**.

> **Amended: the names are closed, the uniqueness is gone.** A design may claim
> `body` three times, and a [[Playbook]] supplying an array fills them **in tree
> order**; a single value fills the first slot only, and words with no slot to go
> in write nothing.
>
> Uniqueness was enforced by a silent key-drop — a second node claiming a Role
> kept the *node* and lost the *Role* — and what that cost was not "those words
> cannot be filled". A snapshot strips the words from every text node and binds
> them back only where a Role binds, so a role-less paragraph reached a real
> Optin as an **empty `<p>`**: a three-benefit row showed one benefit and two
> blank lines, while the gallery card looked right because a library entry keeps
> its own placeholder text.
>
> **Binding is still by name**, which is the whole guarantee — the words survive
> switching Template. See
> [ADR 0051](docs/adr/0051-a-slot-role-repeats-and-binds-in-order.md).

Slot Roles are the seam between the two halves of a designed Optin: a Template
declares which Roles it offers, a [[Playbook]] supplies copy against them, and
neither needs to know the other's internals. A Role a Template does not declare is
dropped when a Playbook prefills it — a case prevented at authoring time, since a
Playbook's default Template is validated to declare every Role it fills.

Because a Role repeats, a name no longer identifies a *slot*. Anything that has
to point at one — the builder's preview, which agrees with the block tree on a
key derived independently on both sides — numbers it by position among the
same-named slots the renderer actually draws, per step.

A field's Roles are **derived rather than declared**: they are named for what it
captures, so a `field` capturing an email offers `email_label` and
`email_placeholder` and cannot offer the phone's. That is why a field node carries
no Role of its own while six of the vocabulary's Roles are named for fields, and
it is what makes the field kind part of the *design* — a Template capturing an
email cannot serve the SMS [[Goal]] however its words read.

### Destination

A configured endpoint a captured [[Lead]] is pushed to — WSMS, MailPoet, an email
service provider, a webhook, or the lead-magnet delivery email.

A Destination is **outbound and fallible**: it is configured, it is optional, it
can be one of several, and it can fail without the capture failing. Anything that
is none of those is not a Destination — so **the local Lead log is not one**. The
log is where a Lead is *stored*: written first and always, not configurable, not
optional, and if it fails the capture itself failed. Naming it a Destination
would put a member in the set that satisfies none of the set's invariants.

Destinations are the only way a Lead is pushed out of WConvert **automatically**.
CSV export is a manual admin action, not a Destination.

A Destination is configured once, site-wide, and *includes whatever selects the
target inside the remote system* — the Mailchimp audience, the WSMS tag. So a
Destination is a **named route**, and the name is the merchant's own: two
Destinations of one type over one [[Connection]] differ only in what they point
at, so *"Newsletter signups"* and *"Product updates"* are two MailPoet
Destinations and the name is what tells them apart on the [[Optin]] that binds
one. Renaming breaks nothing — the binding is by id. Whatever the selector is, it
is only ever **added**: a Lead arriving cannot remove the audience or tag
membership a [[Contact]] already has, because that membership is a decision the
owning system made and WConvert has no standing to revise. An
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

A Destination failing is **invisible to the visitor**. That is what "fallible
without the capture failing" means followed through: the [[Lead]] is already
written, the push is queued and retried, and the visitor is on the list — so
there is no error state in a [[Template]] and there will not be one. The only
thing such a state could report is the local write failing, which is an outage
rather than a step in anyone's journey
([ADR 0044](docs/adr/0044-there-is-no-visitor-facing-error-state.md)). Failure is
visible to the *merchant*, on Destination health and in the failure ring, which
is where it can be acted on.

A **test send** is the merchant's own address pushed to a Destination to prove it
works. It writes no Lead — a Lead has exactly one origin and carries a
[[Consent Record]] that cannot be invented — it is answered immediately rather
than queued, and it moves no counter at all: a failed test is a question
answered, not an outage.

Its sibling is a **connection test**, and the two are kept apart because they
answer different questions. A connection test asks whether the stored
credentials are good, which is what a merchant wants the moment they paste a
key; a test send asks whether a push lands, which is what they want when the
credentials are fine and the [[Lead]] is not arriving. A Destination whose type
has no [[Connection]] has nothing to check and says so — every free type is in
that state — because reporting success there would teach the merchant that this
button is the other one.

### Connection

Stored credentials for one remote account — a Mailchimp API key, a Brevo key. One
Connection backs one or more [[Destination]]s, so two Mailchimp audiences are two
Destinations over one Connection and the merchant pastes the key once.

Not every Destination has one. A webhook's URL is its whole configuration, and
the lead-magnet delivery email, the WSMS push and the MailPoet push authenticate
against nothing — the last two because they are the same site, where there is no
key to paste.

### Standalone

WConvert running with no [[Destination]] that depends on another system — no
WSMS, no MailPoet, no email service provider, no webhook. Capture works,
[[Lead]]s are recorded, CSV export works, and the lead-magnet delivery email
still sends, because none of that leaves the WordPress install.

**Free's three Destination types are the three that never leave it**, and that
is one rule rather than three exceptions: a Destination that calls out over HTTP
is [[Pro]]'s, so what free may register is whatever is already in this process —
the WSMS push, the lead-magnet email, and the MailPoet push
([ADR 0049](docs/adr/0049-the-mailpoet-push-adds-membership-without-touching-status.md)).

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

Pro is **one plugin at three [[Tier]]s**, and a customer moving up replaces their
install rather than adding a second beside it.

### Tier

Which install supplies a registry member: `free`, or one of Pro's three rungs —
`basic`, `pro`, `elite`. A **ladder**, not a flag: a higher rung supplies
everything a lower one does, and `free` is supplied by all of them.

**One tier is sold and all three display as "Pro".** The words are data
(`tiers.json`), so splitting the range later is an edit to that file rather than
a code change and a migration of every `tier` already saved on a live [[Optin]].

A tier is **inferred, never stored**: an install reads its own rung back off the
[[Module]] directories its build left behind. Possession is the whole gate — a
module you do not have supplies nothing, whatever an install claims to be — so
this is the same sentence [[Pro]] already makes, counted rather than answered
yes or no.

> Every registry declares `tier` locally, on members it already enumerates.
> There is no cross-cutting list of premium capabilities anywhere, and adding a
> rung adds no list either.

### Module

A named unit of premium capability, and **a directory** under `pro/modules/`
holding its own `module.json`. Everything inside it is the module — its PHP, its
loader source, its designs — and nothing outside it is.

That is what makes a per-[[Tier]] build a deletion rather than a list of paths
somebody maintains, and what lets an install infer its own rung by looking at
what is on disk. A module is not a runtime concept: nothing loads one, registers
one, or asks whether one is enabled. It is a boundary the *build* cuts on and the
file system answers about.

### Availability

Whether a member of a registry — a [[Trigger]] or [[Condition]] type, a
[[Display Type]], a [[Template]], a [[Destination]] type, a [[Goal]] — can be used on
this install right now. Three states, and the distinction between the last two is
load-bearing:

- **`ready`** — present and usable.
- **`locked`** — absent because the install does not have the [[Tier]] the member
  is declared at. Buyable from us.
- **`unavailable`** — absent because something the *site* would need is missing: no
  WooCommerce, no WSMS, no MailPoet. Not buyable from us.

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

### Milestone

A **date a site reached something once** — the five facts that say whether WConvert
is working end to end on this install: an [[Optin]] published, something shown,
somebody converted, the capture reaching a [[Destination]], and the first time a
merchant changed something a [[Playbook]] suggested.

Every Milestone is a fact about the **site**, never about a person. None of them
needs to know who did anything, and *"record once"* is not a reason to start —
there is no visitor identifier ([[Storage Consent]], ADR 0017), no Optin id and no
user id in what is stored.

**Milestones, not an event stream.** Four of the five are a date recorded once, on
the site's own clock, exactly as a daily counter is stamped. Two of those four are
not stored at all: the first [[Impression]] and the first [[Conversion]] are the
earliest day the counters hold, and a minimum cannot move forwards. The fifth is
not a date — [[Destination]] success and failure are read out of the health that is
already recorded per Destination, and restated nowhere.

**Nothing leaves the site.** They are local, site-owned facts on the site's own
screens, and reading them is what a merchant does; sending them anywhere would be a
separate decision with a separate consent conversation.

> **The first edit is the one that reads the catalogue.** The five [[Goal]]s and
> their Playbooks were derived by classifying market listings and reviews, and
> nothing has challenged that guess. *Which* part of a Playbook's suggestion a
> merchant overrode first — its Goal, its design, its words, its rules or its
> targeting — is the sharpest available evidence that a Goal's defaults are wrong.
> A part is one of the things prefill actually writes, because an override is only
> evidence where there was an opinion to override: binding a Destination or
> capping [[Frequency]] is not one, since a Playbook supplies neither.

A Milestone that has been reached changes nothing a merchant does next, so the
screen draws only the first one *not* reached, with the door that fixes it — and
nothing at all once a site is converting.

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

# WConvert — Domain Context

WConvert is a WordPress lead-capture plugin: it displays conversion campaigns
(popups, bars, slide-ins, inline forms), decides who sees them and when, and
pushes captured leads onward. It runs standalone and integrates with WP SMS
(WSMS) when present.

It serves subscriber collection and enquiries. A quote request is a captured
Lead that another plugin or service can act on, not an inbox thread, contact
profile or job managed by WConvert.

## Glossary

### Lead

A capture record from one visitor's [[Capture journey]] into one [[Optin]].
Its first accepted submission creates it; explicitly submitted additions in the
same journey can add details and separate consent evidence. A Lead has no
Contact lifecycle: it is never "confirmed", "unsubscribed", "bounced", or
"re-engaged". It is not a managed person profile.

Submitted details and their consent evidence stay fixed; later submissions add
to them. Going Back may review submitted details but cannot replace them.

The implemented progressive journey contract is recorded in
[ADR 0103](docs/adr/0103-progressive-capture-keeps-one-lead-per-journey.md).
The Free runtime supports linear screens with one primary submission and an optional
other-channel signup, saved independently within the same capture journey. Pro
also supports questions and answer-dependent screens, with at most one Results
screen. See [ADR 0106](docs/adr/0106-question-journeys-extend-the-paid-loader.md).

"Never confirmed" is the sharpest case, because it is the one every competitor
gets wrong: **WConvert has no double opt-in and never will.** Confirming an
opt-in means reading and mutating [[Contact]] state, which the [[Destination]]
contract forbids outright. Where double opt-in is wanted it belongs to whoever
owns the Contact — WSMS's own subscription form, or the ESP's audience setting.

Not every [[Conversion]] is a Lead. A click-through or an anonymous quiz result
produces a Conversion without a Lead.

A submit design's success copy acknowledges the captured request. It must not
claim that a Contact is subscribed or confirmed, or that a message or resource
was delivered. Shipped examples follow that rule; existing merchant copy is
not bulk rewritten. See [ADR 0073](docs/adr/0073-capture-acknowledgement-is-not-provider-confirmation.md).

**Independent captures are never deduplicated.** One person completing two
separate capture journeys produces two Leads. Further submissions in one
journey add to its Lead rather than creating another. That two Leads are one person is a question
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
explicitly submitting details on a page WConvert served. A progressive journey
can contribute more than one submission to its Lead. Nothing else creates
one — no admin entry screen, no CSV import, no import from another plugin. A row
arriving any other way would be asserting a capture event that never happened
here, and would carry no [[Consent Record]], which is the half that cannot be
invented.

WConvert owns Leads.

The public browser `wconvert:capture` event acknowledges the first accepted Lead
in a mounted journey, including quiz contact capture. It never denotes provider
confirmation or repeats for optional additions. See
[ADR 0110](docs/adr/0110-public-browser-events-describe-campaign-outcomes.md).

When a visitor explicitly submits contact details after answering Pro questions,
the Lead also holds a snapshot of the active question IDs, wording, values and
choice labels in existing JSON storage. Skipped answers are excluded. An
anonymous completion creates no Lead and stores no individual answers; only
aggregate completion and result-click counts remain. A later optional signup
adds one Lead without a second Conversion.

A form can also ask one choice question under the canonical key `interest`.
Its stable selected value and the label from the published choice definition
at capture are stored as `interest` and `interest_label` in the Lead's existing
`fields` JSON. The endpoint validates the value against that published form;
neither a browser-supplied label nor an arbitrary extra field is trusted. These
answers do not identify a person, imply marketing consent, or acquire a
lifecycle. Capture history and CSV show both values; email or phone remains
necessary for a Lead. See [ADR 0076](docs/adr/0076-an-enquiry-captures-one-optional-choice-before-handoff.md).

The capture-history read also supports explicit literal text search over
captured name/message and email/phone, and purpose views for list-collection
and enquiries. Leads shows compact capture rows with detail dialogs; sending
diagnostics remain separate from per-capture state. Shared site settings live
under Visitor experience, Connections & destinations, and Data & privacy.
See [ADR 0091](docs/adr/0091-shared-settings-and-submission-workflows-have-distinct-homes.md).

The capture-history read can locate a complete canonical email/phone or exact
Lead ID, narrow by Optin and site-calendar dates, and page the matching events.
Grouping and group drilldown remain views of those events, not Contact profiles.
CSV takes all retained matches under the view's upper capture bound, not just
the visible page. Newer captures require refresh; deletion can still remove
earlier rows. See [ADR 0071](docs/adr/0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md).

Captured contact details and free-text searches are temporary admin state.
Reads and CSV exports send those filters in authenticated POST bodies, not in
browser/server URLs; refreshing or copying the page therefore does not retain
them. Campaign, purpose, date and order filters remain bookmarkable, as does an
opaque Lead ID in the browser fragment for diagnostic links. See
[ADR 0091](docs/adr/0091-shared-settings-and-submission-workflows-have-distinct-homes.md).

Privacy erasure is exact-identifier-wide, not per submission and not person
resolution. After verifying a request outside WConvert, a merchant can export
and permanently delete every retained Lead whose `email` or `phone` column
directly contains that canonical identifier. No Campaign/date filter may narrow
the deletion, and it never follows the other identifier to more rows. Related
terminal-failure diagnostics are removed; downstream Contacts, exports, logs
and backups remain an explicit merchant follow-up. See
[ADR 0093](docs/adr/0093-privacy-erasure-is-bound-to-one-explicit-identifier.md).

Data & privacy also presents a read-only Data Map of what this install can
prove: saved retention, configured Destination types and declared fields,
browser-local campaign state and its fallback-cookie lifetime, and the short
anonymous-count and form-protection rate-limit windows. Pro adds only facts for
modules this install can actually run: A/B assignment state and, with
WooCommerce cart recovery, a session cookie containing cart count and total but
no product or contact details.
The same facts feed WordPress's suggested privacy-policy text; they never expose
credentials, publish policy wording, choose a legal basis or claim to erase
external copies. See
[ADR 0094](docs/adr/0094-privacy-guidance-reports-the-current-data-flow.md).

Privacy Guidance is a site-wide authoring preference, on by default. It adds
short purpose-specific privacy defaults to new Campaign setups and checks them
in the editor's readiness review. A form used for one request starts with a
policy notice; a Campaign growing an ongoing email or SMS list also starts with
explicit consent visible; a click-only Campaign has neither because it captures
no visitor data. The Goal's outcome decides this, never the chosen Template.
Turning guidance off removes that automatic help only from future drafts;
existing Campaign snapshots, manual controls, export, erasure, retention,
Consent Records, the Data Map and WordPress policy tools do not change. See
[ADR 0096](docs/adr/0096-privacy-authoring-help-is-progressive-and-snapshotted.md)
and [ADR 0099](docs/adr/0099-privacy-defaults-follow-campaign-purpose.md).

### Analytics impact

Analytics starts with compatible totals: captured submissions, offer clicks,
cart return clicks and appearances. It never reports a global conversion rate,
unique people, purchases or recovered revenue. Goal and individual Optin reports
explain their denominators. Resource requests and accepted email sends remain
separate. Complete-day comparisons are resolved in the site's calendar; no
visible timezone label is needed. Campaigns also uses complete days through yesterday; editor windows still include today.

Paused and soft-deleted Optins retain inspectable history; never-published
drafts without counters are excluded. Parent/variant grouping is presentation,
not another counted entity. A/B reports cover selected dates across designs'
past uses, not immutable test rounds. See
[ADR 0089](docs/adr/0089-analytics-starts-with-impact-and-keeps-history-inspectable.md).

### Monthly target

An optional site-wide count the merchant wants to reach in a calendar month,
not an Optin's [[Goal]]. Targets follow actual impact and use the same historical
submission/offer-click/cart-click counts through yesterday. They never pause
campaigns, reset results, or renew automatically. Saved months remain distinct;
reusing last month's numbers is an explicit draft edit. Target report links keep
their calendar month independently of rolling report dates. See
[ADR 0090](docs/adr/0090-monthly-targets-are-optional-benchmarks.md).

### Conversion

A visitor doing the thing an [[Optin]] exists to make them do — the countable
act its [[Goal]] names. Submitting a form is one kind of Conversion; clicking
through to an offer and completing an anonymous quiz result are others.

Most accepted Leads are Conversions; a quiz Lead is not a second Conversion.
The reverse does not hold either: anonymous quiz completion and link clicks
create no Lead.

A capture-only progressive [[Capture journey]] converts at its first accepted
capture. Later submissions add to the same Lead without another Conversion.
A Pro quiz converts when its selected result appears, whether it asked for
contact first or offers an optional signup afterward. Captures in that quiz
are recorded separately. Next, Back and Skip alone do not convert. This is the accepted product
contract in [ADR 0103](docs/adr/0103-progressive-capture-keeps-one-lead-per-journey.md).

**One Optin has exactly one converting act**, and its ~~[[Goal]]~~ **design**
decides which: a design whose button submits converts on the submit, one
whose button links away converts on the click, and a quiz converts
on its first selected result. A [[Template]] offering both unrelated acts is
rejected when it is registered, not disambiguated at runtime — an Optin with two
candidate Conversions has no honest number to report.

A `followup` resource link and a code’s optional copy button do not count. The
resource link belongs on the capture acknowledgement; it opens a configured file
or page without another conversion. See [ADR 0080](docs/adr/0080-success-actions-do-not-count-again.md).

> Runtime conversion detection still reads the design
> ([ADR 0059](docs/adr/0059-the-converting-act-belongs-to-the-design.md)).
> [ADR 0085](docs/adr/0085-goals-have-publish-contracts-and-stable-history.md)
> adds Goal compatibility at publication and precise labels; it does not add a
> second runtime conversion detector.

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

Leaving without converting is not a Dismissal. Dismissal and conversion can overlap when a visitor reopens a Campaign; daily totals cannot reconstruct abandonment by subtraction (ADR 0101).

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

> **Accepted extension, not yet implemented:**
> [ADR 0110](docs/adr/0110-integrations-share-setup-and-map-extra-answers-per-campaign.md)
> adds a per-Destination choice to update eligible mapped **non-identity** values
> on adapters with a verified safe write path. Keep existing details is the
> default. The existing prohibition on identifier replacement, merging and
> subscription/suppression changes remains. WSMS and MailPoet retain their current
> behavior until their individual adapter support is verified.

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
itself to match the current copy is evidence of nothing. Each acceptance has
its own channel or purpose, exact wording, and time. Email and SMS accepted at
different points in one journey have separate evidence; later evidence does
not rewrite the earlier record. The current single-submit implementation uses
the Lead's creation time; progressive capture follows
[ADR 0103](docs/adr/0103-progressive-capture-keeps-one-lead-per-journey.md).

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

**Free's persistent per-visitor state lives in one key**, and it is worth knowing
its name because three documents once described storage WConvert does not have.
`localStorage['wcv1']` holds a map of [[Optin]] id to that Optin's record —
impressions, the day of the last one, dismissed, converted — written through a
`localStorage → cookie → in-memory` ladder that fails open
(`resources/loader/src/state.ts`). There is no persistent key per Optin. ADR 0101 adds one site-scoped sessionStorage key for explicit recovery choices: an active Campaign/arm and at most 64 stopped families, never form values or identity. Blocked session storage limits recovery to the current document.

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

Public form capture has a separate, deliberately generous abuse boundary: 60
attempts per Campaign and server-observed network address in ten minutes, plus
a 16 KiB request-body cap and field-length limits. The transient key contains
only a site HMAC of address and Campaign ID, expires with the fixed window, and
never stores the raw address. A missing server address fails open so a proxy
configuration mistake cannot block every real visitor. This is an operational
security default, not an optional privacy feature.

Optional bot verification is a separate pre-capture boundary, never a
[[Destination]]. Free includes Turnstile Managed, reCAPTCHA v2 checkbox and
hCaptcha with merchant-owned keys, a hidden-field check, and a ten-minute
recipient/resource guard on queued resource emails. Pro adds explicit exact
email/domain filters and email exceptions. One server-verified grant covers one
[[Capture journey]]; independent captures remain independent Leads. Unverified
requests receive a retryable form response, not a saved Lead or success screen.
Settings → Spam protection owns these site-wide choices. No external provider
is enabled by default. See [ADR 0111](docs/adr/0111-spam-protection-precedes-capture.md)
and the [setup guide](docs/guides/spam-protection.md).

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
states the configured period. The text is a WordPress policy-guide suggestion
for the merchant to review, not a published policy; the same saved fact appears
in Data & privacy's Data Map.

The admin's controls are a draft until **Save retention**. Enabling or changing
automatic deletion confirms the actual chosen days before writing; typing,
clearing or leaving the number field does not commit a policy. The disclosure
continues to describe the saved setting if a write fails. This changes no
existing option/default or prune behavior ([ADR 0071](docs/adr/0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md)).

### Optin

The unit of work in WConvert: one designed thing, shown to a chosen audience,
under a set of display rules, serving one [[Goal]], pushing to one or more
[[Destination]]s.

Campaigns management shows saved-design previews, list/gallery views, family-aware
filters and anchored actions. **Live** means a published unsuspended snapshot;
display rules still determine appearances. **Pause** unpublishes; storage has no
separate paused state. The compact shared header names the installed tier and
shows real known issues on request. See [ADR 0092](docs/adr/0092-campaigns-use-a-design-led-workspace-and-compact-masthead.md).

> **UI: Campaign; domain: Optin.** [ADR 0086](docs/adr/0086-campaign-setups-explain-handoff-and-format.md)
> adopts familiar merchant language while preserving technical identifiers. The
> WConvert screen describes on-site forms and offers; WSMS campaigns are outbound
> sends. Qualify the product when discussing both together.

An Optin is never hard-deleted. Its counters reference it by id, so a removed row
would make every count naming it uninterpretable — which is also why ending an
A/B test cannot delete the losing [[Variant]].

Live overlays notify page scripts through `wconvert:open` and `wconvert:close`.
These describe actual presentation transitions, not changing journey screens or
analytics impressions/dismissals. Campaign details can copy existing campaign
or variant IDs. See [ADR 0110](docs/adr/0110-public-browser-events-describe-campaign-outcomes.md).

### Variant

One arm of an A/B test — **and a whole [[Optin]]**, not a shape inside one. It
has its own id, its own row, and therefore its own counters, because
`wconvert_stats` is keyed by `optin_id` and that key is what makes the counter
upsert atomic. Two designs behind one id could not be told apart, which is the
entire point of the test.

**Two arms of one test convert the same way**, and that is a rule rather than a
coincidence: an arm holding a form beside an arm holding a click CTA compares a
~3% submission rate against a ~25% click rate, and the winner is between two
different questions. It used to be true by accident — a variant copies its
parent's [[Goal]], and a Goal declared an act — and it is now refused at the
write, on the arm's own design
([ADR 0059](docs/adr/0059-the-converting-act-belongs-to-the-design.md)).
Swapping an arm for a different design of the *same* act is what the test is
for.

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

### Reopen button

An optional Pro presentation for popup and slide-in. After deliberate full dismissal, a compact, dismissible button lets the visitor return to the same eligible Campaign across pages in the current browser tab session. It never auto-expands. Closing the button or conversion stops recovery for the family during that session. The mounted form and pending capture survive same-page hiding; confirmed hidden success becomes a dismissible “View details” reminder without stealing focus. It is not a Template step or Display Type. An eligible restored reminder owns the single overlay slot ahead of fresh automatic campaigns; explicit activation bypasses automatic pacing while retaining conditions, consent, schedule and stop-after-conversion. See [ADR 0101](docs/adr/0101-reopen-buttons-preserve-an-explicit-visitor-choice.md).

### Frequency

The allowance — how often this device may be shown something — checked before any
[[Trigger]] or [[Condition]] is evaluated. The shared persistent fields are: a maximum number of
impressions, a cooldown in days, stop after a [[Dismissal]], and stop after a
[[Conversion]].

Campaigns also support `maxPerSession` (1–100) in a bounded, site-scoped
`wcv_display_session_v1:<capture endpoint path>` sessionStorage record, shared
across A/B arms. Only counted appearances with a configured cap write it. It
holds up to 128 families; denied storage lasts for the current document only.
New interruptive drafts explicitly use one per tab session, dismissal-stop off
and completion-stop on. Site scope does not add this field. See [ADR 0104](docs/adr/0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md).

It has **two scopes and one shape**. Per [[Optin]], the two switches default *on*
and the two numbers *off*, because a visitor who closed something said stop
showing me *this*. Site-wide, the same four fields are held once for the whole
site and **all of them default off**, because reading one dismissal as "show me
nothing anywhere for a week" is a claim about what the visitor meant that they
did not make.

For automatic presentation, site scope is a **veto**, checked first: an Optin cannot opt out of it, since a
per-Optin *ignore the site setting* is the configuration having two scopes exists
to delete. A visitor stopped by either scope is `capped` — the standing
`resources/loader/src/decide.ts` already gives an Optin whose allowance is spent
and cannot change on this page view — and never a seventh word.

An explicit [[Reopen button]] click bypasses automatic pacing at both scopes, while stop-after-conversion still applies (ADR 0101).

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

**Admin scope clarified by [ADR 0072](docs/adr/0072-setup-choices-state-their-effect-and-scope.md):**
date controls name the actual site zone, and labels preserve the authored wall
components rather than normalizing through the admin browser's DST rules. Ended
status is an advisory in the explicit site zone; unknown zones stay neutral,
and repeated/skipped hours wait for the latest plausible end. PHP's published
instant remains authoritative. A repeated hour is not guaranteed to resolve to
its first occurrence in every timezone.

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

*How* an Optin appears: `popup`, `floating_bar`, `slide_in`, `fullscreen`, or `inline`.

Display Type is **not** the primary axis of the product. Users arrive via a
[[Goal]], and the type is prefilled by the chosen [[Playbook]] — selectable as
an override and a filter, never the first question asked. In the design library,
browsing a format edits nothing; applying a design updates its identity, tree and
Display Type atomically, undoable as one draft edit (ADR 0086). The Design tab
names the current format and effective physical placement before the merchant
opens the library. Inside the library, the Goal names the default fit filter;
switching format never changes the Goal.

Four of the five are **overlays** — `popup`, `floating_bar`, `slide_in`, `fullscreen` — which
compete for the visitor's screen, so at most one is shown per page view.
`inline` is not an overlay: it renders in content. Manual embeds never compete;
Pro's automatic placements have their own one-per-page priority selection after
eligibility, separate from overlays (ADR 0099).

**The five are a closed set in PHP** (`src/Optin/DisplayType.php`), enforced on
the way in like every other closed vocabulary, and `popup` is what absence means
on both sides — the renderer mounts an entry with no Display Type as a popup and
the loader reads anything that is not `inline` as an overlay. So a value nothing
recognises is dropped at the write rather than shipped to a page that cannot
place it. Three of the five are [[Pro]]'s in practice, but the enum says nothing
about tier: a free install simply has no fullscreen, floating-bar or slide-in design to
name.

Fullscreen is a viewport-filling modal, not a new Goal or a scrolling welcome
mat. All paid tiers supply it. Its container owns safe-area padding, scrolling,
focus and dismissal; `width` remains the content measure. Existing Template
JSON needs no new token or schema. See [ADR 0098](docs/adr/0098-fullscreen-is-a-pro-modal-surface.md).

### Overlay Placement

The logical viewport edge or corner where a non-modal overlay sits. A floating
bar may use the block-start or block-end edge; a slide-in may use any
block-start/block-end and inline-start/inline-end corner. Logical words are the
stored contract so the same Optin follows the site's writing direction.

Overlay Placement belongs to the container and is campaign configuration, not
part of a [[Template]]'s tree or tokens. Absence means the original defaults:
block-end for a floating bar and block-end/inline-end for a slide-in. Explicit
defaults, unknown values, values belonging to another [[Display Type]], and all
placement values on `popup` or `inline` are removed on write. Applying another
design of the same Display Type keeps it; changing Display Type resets it.

It is distinct from [[Targeting]] (which pages are eligible), [[Anchor]] (where
an inline Optin was embedded), [[Trigger]] (when it appears), and [[Display
Type]] (which container draws it). See [ADR
0095](docs/adr/0095-overlay-placement-is-logical-container-configuration.md).

### Anchor

Pro can create an Anchor automatically in rendered post/page content, before,
after, or after a counted paragraph. `config.inline_placement` is distinct from
Overlay Placement and Template JSON. Manual remains the default and takes
precedence for the same campaign. Inline placement is edited under Display rules
→ Placement, not in Design. Publish review links directly to those settings.
PHP emits hidden candidates; browser eligibility
and A/B assignment select at most one automatic winner, without changing saved
articles or introducing another cache. See
[ADR 0099](docs/adr/0099-automatic-inline-placement-uses-rendered-content.md).

Manual Anchors also use WordPress's existing layout surfaces: the same block in
post content, classic-theme widget areas, and block-theme templates/template
parts, with the shortcode as the legacy/page-builder fallback. WordPress owns
which sidebars, footers and template parts exist; WConvert neither registers nor
chooses one. Placement guidance lives under Display rules, not Design. See
[ADR 0100](docs/adr/0100-manual-inline-placement-uses-wordpress-layout-surfaces.md).

Where an `inline` [[Optin]] was put — one empty element carrying one attribute
and the Optin's id, and **the whole contract between authoring and rendering**.

`inline` is the one [[Display Type]] that is not an overlay: it renders where
it was embedded and never competes for the screen, which is why it alone needs
somewhere on the page to go while the other four mount themselves. So the two
manual ways a merchant places one — a Gutenberg block and a shortcode — do not differ
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

### Content lock

An optional Pro inline [[Campaign]] journey that reveals a merchant-selected
WordPress content region after acknowledged [[Lead]] capture. It uses a saved
container block, an article-remainder divider, or paired shortcode, with one
active region per document and a 30-day browser-local Campaign-family receipt.
It creates no [[Contact]] identity
or subscription state. If the form cannot operate, the region stays readable;
its HTML and direct file links are public. Automatic placement and Content lock
are mutually exclusive. See [ADR 0102](docs/adr/0102-content-lock-is-an-optional-inline-capture-journey.md).

### Targeting

*Where* an [[Optin]] is allowed to appear: the set of pages it may show on, as
an include list and an exclude list, with exclude winning.

Targeting is evaluated on the **server** at asset-enqueue time. The five page
rules are `post`, `singular`, `archive`, `term`, and `url`. Page exclusions
always win, outside audience OR groups.

Account predicates (`logged_in` and `role`) live inside `display_rules` audience
groups. PHP reduces those leaves for the current request while preserving the
group's ALL/ANY meaning, because the browser cannot read WordPress's HttpOnly
auth cookie. They are never global Targeting gates. See [ADR 0104](docs/adr/0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md).

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

The explicit **entire site** mode allows an empty include list, so exclusions
can stand alone. **Selected pages** with an empty list is an incomplete draft
and cannot publish.

> **Why not "Placement":** in adtech that means position on the page, which is
> what [[Display Type]] already covers. **Why not "Audience":** WSMS's
> `Campaign` has an audience resolver, and both plugins share one wp-admin.

### Trigger

*When* an [[Optin]] fires — time on page, scroll depth, exit intent.

A Campaign's `display_rules.opening` is Immediate, Automatic (ALL/ANY requirements,
with optional minimum elapsed seconds), or an explicit Click. Immediate is its
own mode; an empty automatic or click group is incomplete, never immediate.

Time and scroll-depth thresholds remain achieved after crossing. Inactivity is a
live visible-page state reset by activity and visibility changes. Exit, scroll-up
and click are fresh gestures evaluated synchronously; an early gesture cannot
be replayed when a timer later expires. Multiple fresh gestures or inactivity
plus a leaving gesture cannot be required together. The manifest records these
semantics. See [ADR 0104](docs/adr/0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md).

### Condition

*Whether* a visitor is eligible to see an [[Optin]] — device, referrer, cart
state, time of day.

Pro can also check for signs of ad blocking with a short, document-local
cosmetic-interference probe. The check reports detected, not detected or
inconclusive; pending and inconclusive match neither authored status. It does
not identify an extension, store a visitor profile or prove that WConvert's
own loader and requests were delivered. A Campaign whose paid module is absent
is suspended as for other authored unavailable Conditions. See
[ADR 0109](docs/adr/0109-ad-block-observation-is-a-bounded-condition.md).

Audience is Everyone or up to five alternative groups. A group requires ALL or
ANY of up to eight Conditions/account leaves; the groups combine with OR.
Required Goal predicates are outside those alternatives. The chosen expression
must hold at the instant the opening requirements are met. They are not
evaluated ahead of time and held: an Optin whose cart emptied while its ten
second timer ran does not show.

> **The distinction is load-bearing and fixed per rule.** A rule type is a
> Trigger or a Condition, never both — `scroll_depth` means "when they reach
> half way", and there is no second spelling meaning "if they already had".
> Without the split, an engine holding several eligible Optins cannot tell
> "waiting" from "ineligible".

### Goal

The business outcome an [[Optin]] serves, selected before choosing a [[Playbook]].
It remains visible in the editor alongside the precise metric WConvert can prove.
The seven Goals stay business-oriented; their counts do not claim subscriber state,
inbox delivery, bookings, orders or revenue that WConvert does not observe.

A Goal can change until first publication. After publication, including after
unpublishing, it is fixed. **Duplicate for another goal** copies the current draft
into a new Optin with a separate identity and zero results, leaving the original
and its history unchanged. Variants also keep their Goal. No new storage is needed:
the existing published snapshot survives unpublishing.

### Outcome contract

A Goal's publish requirements and the meaning of its metric, declared together in
PHP and exposed to the admin. It checks the actual edited design, not its template
name or sample copy. The design still owns runtime conversion detection; the
contract checks compatibility before that design becomes live.

| Goal | Required before publishing | Headline metric |
| --- | --- | --- |
| Grow email list | Required email plus a capable service, or explicit Collect only | Email submissions |
| Grow SMS list | Required phone plus a capable service, or explicit Collect only | Phone submissions |
| Collect enquiries | Submit form collecting email or phone | Enquiries captured |
| Recover abandoned carts | Click design; cart URL supplied at runtime | Cart return clicks |
| Promote an offer or content | Click design with an offer/content link | Link clicks |
| Deliver a lead magnet | Required email plus a selected, available, configured lead-magnet email Destination | Emails accepted for sending |
| Find a match | Pro result journey; contact is optional | Completed results |

Submissions are events, not unique people or confirmed subscriptions. Mail
acceptance is not inbox arrival or a download; resends can count again. These are
explicit evidence limits, not additional tracked stages.

Incomplete Goal/design pairings may be saved as drafts. The gallery suggests
fitting designs first using existing action/capture facets, and **Show all designs**
preserves exploration. Publication checks the final design again. A click design
still cannot bind Destinations that would have no Lead to receive.

**Request a consultation** now captures a request rather than redirecting to a
booking page. Its acknowledgement does not promise an appointment. **Request a
quote** remains an inline email form with an optional service choice.

See [ADR 0085](docs/adr/0085-goals-have-publish-contracts-and-stable-history.md).

### Capture journey

One visitor's sequence of screens and explicit submissions within one [[Optin]].
In a capture-only journey, the first accepted submission creates one [[Lead]]
and counts one [[Conversion]];
later accepted submissions in that journey add to that Lead. Navigation alone
captures nothing. Ordinary forms submit once at the end; a primary marketing
signup may offer one optional signup for the other channel. A saved signup
survives abandonment of that optional follow-up.
In a quiz, required pre-result contact is a request, while optional signup
after a result is a separate marketing purpose with visible consent. Both
create a Lead only when submitted; showing the result counts the Conversion.
This contract is implemented under
[ADR 0103](docs/adr/0103-progressive-capture-keeps-one-lead-per-journey.md).

A Free journey is linear: the merchant can arrange its screens and submission
points, including a screen that explains an offer before asking for details.
Pro can ask choice or short-text questions and skip later screens based on
earlier choice answers. It still moves forward in one ordered list: there are
no arbitrary jumps or loops. Its one Results screen selects the first matching
variant, then a fallback. Results may precede an optional signup, so a visitor
can finish without giving contact details. Product cards use the live public
WooCommerce catalog for merchant-selected IDs; unavailable products fall back
to the result's own link.

### Template

A merchant may export one current design and import it into another campaign as
an owned snapshot, with supported local images. File import defaults to the file's
content, previews explicit link decisions, and applies one undoable draft change.
It clears the registered template identity and does not create a library entry or
transfer campaign settings. Free transport retains paid runtime limits
([ADR 0113](docs/adr/0113-template-files-replace-only-reviewed-draft-designs.md)).

The reusable structure and look of an [[Optin]], with sample content for the
gallery that a merchant can explicitly adopt.

Text and consent copy can carry one separate bold phrase, italic phrase and link, stored as structured values rather than HTML. The renderer and Consent Record share the same expansion semantics ([ADR 0078](docs/adr/0078-editor-choices-stay-compact-and-scrollable.md)).

A Template declares which slots exist (a heading, an image, fields, a button), how
they are arranged, and how they are styled. That reusable structure is independent
of campaign copy. The words normally come from the [[Playbook]] that prefilled
the Optin, or from the user. Placeholder text supplies the gallery's examples. The default
**Keep my content** carries the merchant's content by Slot Role and prepares the
actual candidate before Apply. **Use this design's sample content** explicitly
copies the selected design's sample words, assets, links and form settings.
Picture transfer includes painted backgrounds and crop settings, with unmatched
pictures explained before Apply (ADR 0084). Both use the same normalized snapshot endpoint; Apply uses exactly the reviewed
candidate, changes only the draft, and is undoable. Sample offers and links still
need review. A new Playbook draft continues to use its own copy, not those samples
([ADR 0075](docs/adr/0075-draft-history-and-template-content-choices-stay-predictable.md)).

Pro question text and choice labels survive a Template snapshot because they
define the quiz and its conditional references; ordinary display copy still
uses Slot Roles. A Results screen carries ordered variants and one fallback.

A submit Template also supplies a hidden consent control as a capability, not a
decision that the Campaign needs it. With Privacy Guidance on, Campaign setup
reveals that control for ongoing marketing Goals and optional quiz signup, and
keeps it hidden for one-time requests. Choosing another Template reapplies the same purpose-based
starting point; the design never acquires a Goal tag (ADR 0099).

> **"How it is styled" has a scope.** The design sets its tokens for the
> whole of itself, and **layouts and leaves may re-declare the same names for their own appearance** by carrying a `tokens` bag of its own — which is how one design
> holds a cream panel beside a dark one, or gives the form a different ground
> from the headline. The names remain the closed manifest vocabulary at every scope and the
> validation is one function, so a scoped bag is still configuration with
> nothing to sanitise. What no bag can do is **move a box**: a merchant may
> change a box’s appearance through its bag. The structure editor can swap a
> split’s two panes, including their mobile order, without changing their
> contents or stable leaf identities. See ADR 0080 for this later addition. See
> [ADR 0062](docs/adr/0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md).
>
> **A bag may be carried TWICE**, and the second one is the width. `narrow`
> holds the same names again and applies below 24rem (384px) of *container* — so an
> `inline` Optin in a 280px sidebar retunes on a desktop, which is the case a
> viewport query gets wrong. It is what lets a photo pane that is 440px of a
> split be the whole width on a phone with less padding and smaller display
> type, rather than the same values in a narrower box. It is also the one thing
> in the vocabulary that **doubles what a scope stores**, and the payload is
> inlined into every matching page. See
> [ADR 0064](docs/adr/0064-a-narrow-bag-is-the-same-bag-at-a-second-width.md).
> A split's minimum column width (`basis`) can make its panes stack earlier,
> independently of that appearance breakpoint. It defaults to 12rem; forms
> needing more room can use 16rem or 20rem. See
> [ADR 0079](docs/adr/0079-a-split-can-reserve-room-for-its-form.md).
>
> **Picture focus** uses the `image-position` token on backgrounds and image
> leaves. It can be overridden in the same `narrow` bag, so a phone crop can
> focus on a different part of the picture. The default remains centred.
> The editor offers a nine-dot position picker, precise percentage adjustments,
> and verbatim custom CSS. Focus appears only where a picture is present; hiding it preserves its value. Image fit and split ratios use visual previews of the
> existing choices; opening a control never writes a value. Alignment and borders use compact icons; picture shape keeps a preview.
> Textual choices, including typography, use selects and booleans use checkboxes. The inspector groups
> picture, heading, body text and effect settings, pairing short measurements
> where they fit. See [ADR 0078](docs/adr/0078-editor-choices-stay-compact-and-scrollable.md).
>
> **A scoped colour may name another colour rather than spell one**, and that
> is what makes a scope survive a theme. `{"bg": "accent"}` follows whatever
> `accent` is where the box sits; a hex does not, so the deeper a design was
> styled the less a theme did — with twelve themes and forty-nine designs, the
> box a merchant most wants to follow the palette was the one that never would.
> Closed to the seven colour names, and resolved in CSS rather than by the
> renderer, so a theme applied after the render moves it too. See
> [ADR 0063](docs/adr/0063-the-five-things-the-reference-designs-still-could-not-say.md).

> **That boundary is what keeps the library small.** Copy is what makes an Optin
> serve a particular [[Goal]], so with the copy held elsewhere a Template is
> **goal-agnostic** — the library is a set of designs per [[Display Type]], not a
> design for every pairing of Display Type and Goal.
>
> **The library stays goal-agnostic, while the picker suggests fit.**
> Existing action/capture facets power a default fit filter, with Show all designs.
> No Goal tags or Display Type × Goal file matrix is introduced. Incompatible
> drafts stay editable; publication enforces the Outcome contract (ADR 0085).

> **Amended: the library is no longer small, and the boundary is what stops the
> matrix coming back.** Every facet describes the **design's capabilities**
> (how it is arranged, what it captures, whether it has a picture), never its
> Goal or sample campaign. A sample bakery photograph or seasonal headline
> does not make the reusable structure belong to that industry or season.
> Explicitly choosing sample content does not change those derived facets. See
> [ADR 0043](docs/adr/0043-the-library-is-indexed-and-its-facets-are-derived.md)
> and [ADR 0075](docs/adr/0075-draft-history-and-template-content-choices-stay-predictable.md).

A design a paid install did not get is still advertised — a card with a name,
its facets and a link to a live preview, and no tree
([[Availability]], `locked`). A free install is shown no such card
([ADR 0116](docs/adr/0116-free-shows-nothing-it-cannot-run.md)). **So a card is an advertisement, and an
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

> **Corrected again, and the tab it names is gone.** There is no *Content* tab
> and no *Design* tab: there is **Design**, and it is three panes — the block
> tree, the live render, and an inspector whose two halves are *what it says*
> and *how it looks*. The token controls moved into the second half because a
> token has a SCOPE now and *which box* is a selection
> ([ADR 0062](docs/adr/0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md)).
>
> **Every element in the render is directly selectable.** A click selects the
> element under the pointer; breadcrumbs and optional Layers select parents.
> The canvas fits the available space without changing template dimensions,
> and local form preview advances without sending data. See
> [ADR 0067](docs/adr/0067-the-editor-starts-with-the-preview-and-the-selected-element.md).
> Everything the note below says about the vocabulary being the ceiling is
> unchanged.
>
> **The builder is a viewport workspace.** It opens with the canvas and Design
> settings; Layers is optional. Selected leaves have Content and Style controls
> limited to their token readers. Readiness is in the footer, Goal/performance
> in Optin details. Local Undo covers the name and complete draft configuration:
> design, content, rules, targeting, schedule, frequency, priority and selected
> destination ids. It keeps up to 50 snapshots and coalesces a typing burst.
> Ordinary Save preserves earlier history and accepts the normalized response
> as the present state. Undo after Save makes a draft change; it does not change
> published visitor behavior. Shared destination settings and delivery actions
> are outside this history. See
> [ADR 0075](docs/adr/0075-draft-history-and-template-content-choices-stay-predictable.md).

**And the manifest is the ceiling on how well a value can be *edited*, not only
on what may exist** — a token declaring no `choices` whose value no shape test
reads arrives in the panel wearing a raw text box, so where a shape cannot be
inferred the manifest enumerates it
([ADR 0054](docs/adr/0054-every-control-has-the-shape-of-its-value.md)).

### Template pack

A versioned collection of downloadable designs, installed explicitly from a
configured catalog. The format supports Free popup/inline designs and Pro
question journeys for an installed paid tier. It supplies no renderer code,
site-local destinations, product IDs, or links. Installed
versions remain local and retain source baselines; updates affect the library
for future choices, never existing Optin snapshots. Browsing and installation
live in the design picker and the Goal-first creation flow. Packs may also carry
validated Playbooks: their wording and rules enter the existing Prefill path;
installing one creates no Optin. See [ADR 0082](docs/adr/0082-template-packs-install-as-validated-local-data.md)
and [ADR 0083](docs/adr/0083-installed-packs-supply-campaign-starting-points.md).

### Collection

A reviewed discovery list of [[Playbook]]s, shown as campaign setups. It is not a
[[Template pack]]: one setup can appear in several Collections without another
installation or another design. Matching setup and canonical design counts are
shown separately. Optional before/during/after stages and event date windows
help merchants plan; they never schedule or publish an [[Optin]]. The internal
repository studio prepares public authored collections, not customer data.
See [ADR 0112](docs/adr/0112-template-discovery-and-reviewed-collections.md).

### Site occasion

A merchant-owned name and inclusive date range stored in a site option for
planning, such as an anniversary sale. It suggests browsing ideas without
creating targeting rules, discounts or campaign schedules.

### Picker preferences

Saved canonical design identities, hidden Collections, event participation and
market choices, held in user meta scoped to the current site. They are personal
library preferences; Site occasions are shared by site administrators. Favorites
survive a pack version update while exact source baselines retain immutable IDs.

### Starting point

Shown as **Display rule sets** in the UI, distinct from full Campaign setups
(Playbooks), under [ADR 0086](docs/adr/0086-campaign-setups-explain-handoff-and-format.md).

A named set of display rules a merchant can begin from — *"Once they have read a
while"*, *"Only on blog posts"*, *"Rescue an abandoned cart"* — offered in the
rules panel and applied after reviewing and confirming the replacement.

**It is not a preset, and the word is the decision.** *Preset* already means a
per-type shortcut over one rule's general form: `time_on_page {seconds: 5}` is
"after a few seconds", and that is what `RulePreset` and `RuleLabels::presets()`
name. Both would be on this screen at once, since a Starting point that lands
"after a few seconds" is a bundle whose content is a preset. Two meanings of one
word on one screen is what this glossary exists to prevent.

A Starting point **names sections and replaces only the ones it names**. The
rules panel is four sections — **Pages, Audience, When it appears, Schedule &
frequency** under [ADR 0072](docs/adr/0072-setup-choices-state-their-effect-and-scope.md) — and one carrying
Conditions leaves the merchant's [[Trigger]]s alone: an [[Optin]] with no Trigger
can never fire and the save route refuses one, so a button that wiped them would
break the Optin it was offered to improve. Which sections it names is readable
off what it carries, and applying one **confirms first** so replacement scope is
reviewable. Rule changes now participate in draft Undo, including a whole
starting-point replacement (ADR 0075).

The review compares current and proposed values for the sections supplied.
Replacing frequency does not replace campaign dates or overlay priority; those
fields are absent from a rule bundle. Applying changes the working draft and
does not save or publish it. [ADR 0104](docs/adr/0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md) adds bounded groups and supersedes the flat
Trigger/Condition/Targeting semantics.

> *That reason has a second case: changing an Optin's [[Goal]] confirms too, and
> for exactly this — a Goal is a column rather than part of `config`, so there
> is no history entry to walk back to
> ([ADR 0059](docs/adr/0059-the-converting-act-belongs-to-the-design.md)).*

Like a [[Playbook]] it is bundled PHP returning an array — `wp i18n make-pot`
cannot see a string in JSON — and like a Playbook it may not name anything only
one site has: no post ids, no CSS selectors, no cart totals in the store's own
currency. **Unlike** a Playbook it touches no copy and no [[Template]]: applying
one changes rules and nothing else, because there is no reading under which
"start from this" means "replace my headline".

Its [[Availability]] is the least of its rules', so a site with no store is never
offered one that would [[Suspend]] the Optin on the spot.

### Playbook

Shown as **Campaign setup** in the UI (ADR 0086). Task-based names and a derived,
expandable checklist explain the actual design and remaining setup. Cards keep
only the choice summary; full facts and checklist are in optional **Setup details**
(ADR 0087).

A ready-to-run bundle serving one [[Goal]] — a [[Template]], copy, a
[[Display Type]], display rules and destination hints, packaged with notes on why
it works. One Goal has many Playbooks.

Optional `business_types` metadata labels examples for stores, service businesses,
and publishers/creators. Goal-first discovery combines this filter with search,
format and collection. These labels do not restrict Goal or Template eligibility;
untagged third-party setups remain available under All businesses.

A Playbook is **data, not code**: a registry entry, so third parties can add them
and the library can update independently of a plugin release. It carries **no
markup** — copy is plain text, and the one case needing a link inside a sentence
expresses it as structure.

Picking a Playbook **prefills a new Optin by snapshot**: its values are copied
into the Optin and the two never speak again. Improving a Playbook never rewrites
the words on a running Optin, and deleting one leaves every Optin it started
untouched — so `playbook_id` is *provenance*, exactly as `template_id` is.

In creation the merchant-facing term is **starting point**. Goal is the first
choice, and the Playbook is the second; *Customize this starting point* creates a
draft and opens the editor directly. A card's compact setup facts come from the
same resolved Prefill result the draft receives. Browsing does not create or
publish an Optin. This creation bundle includes design and copy, unlike the
rule-only Starting point above (ADR 0072).

The twelve flagship Playbooks are editorial recommendations, four for each of
stores, publishers and services. They appear first within the chosen Goal and
carry an audience label; neither that label nor the collection restricts the
Template library. `FlagshipCollection` owns the membership and ordering. Their
review renders actual Prefill results, including repeated copy roles, rather
than the Template's sample content (ADR 0081).

> **Provenance is not performance.** Two Optins from one Playbook may have been
> edited into unrecognisably different things, so rolling their [[Conversion]]s up
> measures the edits, not the Playbook. The metric is "Optins started from this
> Playbook", never "this Playbook's conversion rate".

Because copy is snapshotted separately from design, a Playbook keys its words to
[[Slot Role]]s rather than to one Template's structure — so the words survive
switching Template, and a Playbook is not married to a single design.

Privacy visibility follows the Goal's outcome at that same snapshot boundary.
Playbooks for ongoing email or SMS lists supply explicit `consent_text` and
start with the Template's consent control visible. One-time enquiries and lead
magnet delivery start with their policy notice only; click-only setups capture
nothing. These are editable defaults, not a legal-basis decision or a publish
gate (ADR 0099).

Choice content follows the same seam: `interest_options` holds a named
`{options: [{value, label}]}` wrapper. The labels are translated words; the
values are stable answer keys. This is one structured Role value, not an array
of repeated Role occurrences. `interest_label` and `interest_placeholder` supply
the question and empty-option prompt (ADR 0076).

The words are the Playbook's mechanism and not the whole of what survives. Two
things a *merchant* supplies are content without being words — an `image`'s
`src` and `alt`, and a `button`'s `href` — so no Role binds to them and nothing
carried them across a switch. `MerchantsOwn` carries what the merchant
**changed**, measured against the entry their copy was taken for, and leaves the
new design's own asset standing where they changed nothing.
[ADR 0084](docs/adr/0084-picture-transfer-and-friendly-style-controls.md) extends
this to background photos and crop settings through `PictureTransfer`;
`MerchantsOwn` retains button destinations.

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
Type* is unavailable does not degrade at all — it is shown as an upsell on a paid
install and hidden on a free one (ADR 0116), since a floating bar reshaped into a
popup is a different design badly made.

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

An options list is one Role's structured content. Its `{options: [...]}`
wrapper survives both `copyFrom()` and `bind()`, preserving stable answer values
with the visible labels. A compatible design can carry them; a design without
that Role cannot. See [ADR 0076](docs/adr/0076-an-enquiry-captures-one-optional-choice-before-handoff.md).

`success_action` carries a resource link’s label and destination together.
`code_value` also carries optional copy-button and outcome messages, while old
string bindings still fill the code itself. These words use the existing stable
leaf identity and translation path.

> **~~One Role exists~~ Two Roles exist that a [[Playbook]] can never fill.**
> `code_value` holds the static shared discount code, and a coupon code names a
> row on one particular site — so it arrives the way the cart URL and the privacy
> link do: the design ships a placeholder and the merchant types theirs into the
> editor. It is a Role rather than plain text so that the code survives switching
> Template like every other slot. See
> [ADR 0061](docs/adr/0061-the-vocabulary-widens-by-what-the-library-cannot-draw.md).
>
> **`wordmark` is the second, and it arrived for the same reason.** It holds the
> shop's or publication's own name, above the offer — the masthead thirteen of
> the sixteen reference designs carry. Unbound it is a role-less leaf, so the
> merchant's own name is thrown away at the next design switch; bound as
> `headline` a Playbook writes the campaign headline into the logo. Being
> `authored` is also what keeps it out of the editor's *first unclaimed Role*
> preference: a default is a guess, and a shop's name is the one thing nobody can
> guess. See
> [ADR 0062](docs/adr/0062-a-token-bag-is-scoped-to-the-box-that-carries-it.md).

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
no Role of its own while field Roles are derived from the vocabulary. Interest
adds a question label, empty-option prompt and structured options list. The
field kind remains part of the *design*; its labels and options are content.

> **Corrected: this ended *"— a Template capturing an email cannot serve the SMS
> [[Goal]] however its words read"*, and nothing ever enforced that.** It was
> never checked at registration, at the write or on any screen, and it is not a
> rule: which detail to ask a visitor for is the merchant's own judgement, and
> an SMS list grown from an email capture is still a list they grew. What IS
> derived is everything before the dash — the Roles a field offers follow the
> kind it captures. See
> [ADR 0059](docs/adr/0059-the-converting-act-belongs-to-the-design.md).

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

`config.capture_mode = local` explicitly selects Collect only and suppresses all
Destination bindings. List Goals otherwise default to connected mode and require
an audience service for the right channel at publication. Destination requirements
declare `audience_channels` separately from captured fields; transactional email
is not audience subscription. See ADR 0086. No Contact state is added to WConvert.

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
[[Optin]] holds Destination ids and optional extra-answer mappings scoped by
Destination and accepted submission, so two Optins feeding one audience can send
different question answers through one route. Where several Destinations share
credentials, those live on a [[Connection]] underneath them.

> **Implemented foundation:**
> [ADR 0110](docs/adr/0110-integrations-share-setup-and-map-extra-answers-per-campaign.md)
> extends Destination ids with optional extra-answer
> mappings in the Campaign configuration, scoped by Destination and accepted
> submission. Accounts, targets and existing-contact policy stay shared; basic
> fields are automatic. Extra mappings have one Campaign-owned home, with no
> Destination default/override hierarchy. See the
> [implementation plan](docs/plans/integration-foundation.md).

Editing a shared Destination shows its saved users: **Saved draft only**,
**Live only**, or **Live and saved draft**. Those facts are read from existing
Optin snapshots, exclude unsaved editor bindings, and do not count deleted or
paused snapshots as live. Saving shared settings affects live uses immediately,
independently of saving or undoing one Optin. Unknown usage is not presented as
an unused route (ADR 0074).

Each shipped adapter declares its identifiers, required settings and values it
uses. WSMS accepts email or phone; MailPoet and lead-magnet email need email.
MailPoet additionally needs a list and can receive optional campaign-mapped
answers in an existing custom text field, for new subscribers only.
Existing subscriber fields remain unchanged. Neither WSMS nor lead-magnet email
forwards extra answers; without a compatible mapping they remain local. The editor
distinguishes an absent required identifier from an optional one and explains
unsupported answers without claiming provider delivery. See
[ADR 0074](docs/adr/0074-destinations-declare-requirements-and-show-shared-usage.md).

The campaign map can include accepted form/quiz answers, interest and message.
The MailPoet existing-contact limitation remains until a safe update path is
verified.

Data flow through a Destination is **one-way at capture time**: WConvert →
Destination. WConvert never reads [[Contact]] state back — not subscription
status, list membership, or suppression — so it never has an opinion about who is
subscribed, and it reads nothing at all on the capture path. Admin-time metadata
reads are permitted and expected: listing a provider's audiences or custom fields
to populate the configuration UI, and testing a connection. Those are reads of
the provider's *shape*, never of a person's state.

In a progressive [[Capture journey]], each completed signup starts its handoff
after it is saved, without waiting for optional later screens. A later SMS
submission must not repeat an email welcome or resource delivery. This accepted
behavior is implemented under
[ADR 0103](docs/adr/0103-progressive-capture-keeps-one-lead-per-journey.md);
The companion [storage plan](docs/plans/184-progressive-capture/storage.md)
specifies submission routing and recovery.

A Destination failing is **invisible to the visitor**. That is what "fallible
without the capture failing" means followed through: the [[Lead]] is already
written and the push is queued and retried. That confirms the capture, not a
Contact's subscription status, which belongs to the receiving system. There
is no delivery-error state in a [[Template]] and there will not be one. Field
refusals and capture failures use inline feedback in the existing form. A
timeout or malformed response reports an unconfirmed submission and preserves
entered values, because it cannot prove that no local write occurred
([ADR 0044](docs/adr/0044-there-is-no-visitor-facing-error-state.md),
[ADR 0073](docs/adr/0073-capture-acknowledgement-is-not-provider-confirmation.md)). Failure is
visible to the *merchant*, on Destination health and in the failure ring, which
is where it can be acted on.

Those diagnostics preserve the provider, outcome and actionable reason, but
submitted Lead/test values, saved credentials and control characters are
removed before a message reaches the admin response, WordPress error log,
Destination health or the failure ring. A useful statement such as “invalid
subscriber” remains useful without copying the subscriber's email or an API
key into operational metadata.

A **test send** pushes an explicitly chosen sample email to the Destination's
saved route. The merchant sees the recipient and possible external effect
before sending; the WordPress profile supplies a visible suggestion, never an
implicit endpoint default. The sample contains email unless the merchant
explicitly enters an optional stable interest value for the saved route's
configured mapping. No name, phone or interest is invented. It writes no Lead —
a Lead has exactly one origin and carries a
[[Consent Record]] that cannot be invented — it is answered immediately rather
than queued, and it moves no counter at all: a failed test is a question
answered, not an outage. Success establishes a handoff, not subscription or
inbox receipt ([ADR 0071](docs/adr/0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md),
[ADR 0074](docs/adr/0074-destinations-declare-requirements-and-show-shared-usage.md)).

Its sibling is a **connection test**, and the two are kept apart because they
answer different questions. A connection test asks whether the stored
credentials are good, which is what a merchant wants the moment they paste a
key; a test send asks whether a push lands, which is what they want when the
credentials are fine and the [[Lead]] is not arriving. A Destination whose type
has no [[Connection]] has nothing to check and says so — every free type is in
that state — because reporting success there would teach the merchant that this
button is the other one.

Recovery remains broad: re-push uses retained Leads from Optins whose published
configuration binds the Destination, since its last success. It can replay an
already successful send; a displayed failure row or skipped count is not its
exact selection. Analytics now presents daily conversion and send totals
separately, not their same-period difference as a per-Lead pending or failure
count ([ADR 0089](docs/adr/0089-analytics-starts-with-impact-and-keeps-history-inspectable.md)). Named-route and capture links help investigate those facts
without creating a delivery ledger ([ADR 0071](docs/adr/0071-reports-capture-history-and-recovery-form-a-connected-admin-flow.md)).

The history extension in ADR 0110 records explicit provider outcomes
against recent Action Scheduler attempts. Scheduler completion alone does not mean
the push landed. Missing/expired or inconclusive evidence is Unknown; no permanent
per-Lead outcome record or inbox/subscription confirmation is promised. This is
shown alongside Destination health, with no durable delivery ledger.

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
  is declared at. Buyable from us. **Hidden on a free install, upsold on a paid
  one** ([ADR 0116](docs/adr/0116-free-shows-nothing-it-cannot-run.md)). Free's
  only upsell is its header link and one static "More with Pro" list.
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

Any missing implementation in an authored display policy suspends the entire
Campaign. This includes a missing leaf in an ANY group; losing a dependency must
not widen the authored policy. Catalog suggestions can still be adapted before
Prefill, but runtime substitution/drop is forbidden. See [ADR 0104](docs/adr/0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md).

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

> **The first edit is the one that reads the catalogue.** The original five [[Goal]]s
> and their Playbooks were derived by classifying market listings and reviews;
> enquiry capture adds a sixth explicit outcome under ADR 0076. *Which* part of a Playbook's suggestion a
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

### External analytics integration

The optional paid analytics integration exports campaign observations through one
selected existing Google tag, GTM container or Plausible script. It is separate from native WConvert statistics
and from Lead Destinations: no provider credential, capture field, lead ID, visitor
identity or outbound delivery queue crosses this boundary. Consent is checked per
observation. Public campaign labels and opt-out preferences follow published family
settings. GA4 and Plausible consume the same semantic observation seam; templates
need no provider-specific selectors. See [ADR 0114](docs/adr/0114-analytics-exports-use-existing-site-tags.md).

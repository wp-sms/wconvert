# WConvert — Domain Context

WConvert is a WordPress lead-capture plugin: it displays conversion campaigns
(popups, bars, slide-ins, inline forms), decides who sees them and when, and
pushes captured leads onward. It runs standalone and integrates with WP SMS
(WSMS) when present.

## Glossary

### Lead

A single capture **event** — one person submitted one form, at one time, on one
page, into one [[Optin]]. A Lead has no lifecycle: it is never "unsubscribed",
"bounced", or "re-engaged". It is a row in a log, not a record under management.

Not every [[Conversion]] is a Lead. An Optin whose success is a click-through
captures no form, so it produces a Conversion and no Lead.

WConvert owns Leads.

### Conversion

A visitor doing the thing an [[Optin]] exists to make them do — the countable
act its [[Goal]] names. Submitting a form is one kind of Conversion; clicking
through to an offer is another.

Every [[Lead]] is a Conversion; the reverse does not hold. Assuming it does
makes any Goal measured by clicks report zero forever.

### Contact

A person as a **managed entity**, with a consent lifecycle (opted in, opted out,
bounced, complained), list membership, tags, and segment membership.

WConvert never owns Contacts. WSMS and external ESPs (Mailchimp, EmailOctopus,
…) own them. A Lead becomes a Contact only by crossing into one of those systems
via a [[Destination]].

> **The line to hold:** a Lead is an event, a Contact is an entity. Any feature
> that wants to give a Lead a lifecycle is a signal that WConvert is drifting
> into being a second contact database.

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
term ids in its targeting, no [[Destination]] ids. A destination hint names
Destination *types* and the [[Lead]] fields the Playbook needs, and prefill never
binds a Destination invisibly.

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
`fine_print`, `success_headline` — drawn from a closed vocabulary and unique
across the Template's whole tree.

Slot Roles are the seam between the two halves of a designed Optin: a Template
declares which Roles it offers, a [[Playbook]] supplies copy against them, and
neither needs to know the other's internals. A Role a Template does not declare is
dropped when a Playbook prefills it — a case prevented at authoring time, since a
Playbook's default Template is validated to declare every Role it fills.

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
target inside the remote system* — the Mailchimp audience, the WSMS list. An
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

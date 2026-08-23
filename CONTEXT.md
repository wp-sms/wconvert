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

### Playbook

A ready-to-run bundle serving one [[Goal]] — template, copy, [[Display Type]],
display rules, and destination hints, packaged with notes on why it works. One
Goal has many Playbooks.

A Playbook is **data, not code**: a registry entry, so third parties can add
them and the library can update independently of a plugin release.

A Playbook requiring a feature the install does not have (exit intent on a free
site) **degrades visibly** — it substitutes the best available rule and says so,
rather than blocking. The premium seam is an explanation, not a wall.

### Destination

A configured endpoint a captured Lead is pushed to — WSMS, Mailchimp, a webhook,
or the local Lead log. Destinations are the *only* way a Lead leaves WConvert.

Data flow through a Destination is strictly one-way: **WConvert → Destination**.
WConvert never reads Contact state back, so it never has an opinion about who is
subscribed.

### Standalone

WConvert with no Destination configured other than the local Lead log. This must
be a fully working install — capture works, leads are recorded, CSV export
works. WSMS is never a runtime requirement of the capture path.

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

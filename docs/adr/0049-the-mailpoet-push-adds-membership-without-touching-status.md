# The MailPoet push adds membership without touching status

The MailPoet [[Destination]] ships in **free**, and it reaches past MailPoet's
own public `MP('v1')` API to add a list membership, because that API cannot add
one without also writing the person's subscription status.

Two decisions, recorded together because the second is the price of the first.

## Why MailPoet is free when every ESP is Pro

[ADR 0007](0007-destinations-are-outbound-and-fallible.md) makes a Destination
that calls out over HTTP a [[Pro]] feature, so free's capture path makes **no
outbound HTTP request at all**. That is not a tier policy dressed up as an
architecture — it is the claim `readme.txt` prints in bold, *"no account, no
phone-home"*, and a free plugin that phoned home for a merchant's own leads
would be a different conversation with the wp.org review team.

Free therefore registers exactly three types, and each is free for one reason
repeated:

| Type | Why it costs nothing free has promised not to spend |
|---|---|
| The WSMS push | WP SMS is a sibling plugin in this process |
| Lead-magnet delivery | `wp_mail()` is WordPress's own |
| **MailPoet** | it stores its subscribers in this database and hands other plugins a PHP API |

MailPoet is the third member of that set, not an exception to it. What decides
the tier is *in-process or over the wire*, and it always was — ADR 0007 chose
that criterion over "is it an external system" precisely so the lead-magnet
email would have a home.

The gap it closes is real rather than tidy: **`Goal::GrowEmailList` had nowhere
to put an email address on a [[Standalone]] install.** A Goal must name an
outcome WConvert can count, and this one could be counted and not served.

**The promise is asserted, not reviewed.**
[`tests/unit/Contract/TheFreeCapturePathStaysInProcessTest.php`](../../tests/unit/Contract/TheFreeCapturePathStaysInProcessTest.php)
reads the SOURCE of `src/Lead`, `src/Destination`, `src/Queue` and `src/Stats`
for any name that reaches the network, because what it guards against is a line
somebody adds and no assertion about output can see a rule that is currently
being kept — the same argument
[ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) makes for the Pro
import scan. `bin/verify-destinations.php` holds the other half on a real
WordPress: `pre_http_request` is watched across a real capture, a real
dispatch, a real MailPoet write and a test send, and must record nothing.

**Scoped to the capture path, deliberately.**
[ADR 0043](0043-the-library-is-indexed-and-its-facets-are-derived.md) leaves
room for a WConvert-hosted template index over the `TemplateSource` seam,
transient-cached and disclosed in `readme.txt`. That is an admin-time library
the merchant asked for, which is a different thing from a capture that phones
home, and a total assertion would refuse it on a test's authority rather than
on a decision anybody took.

**What "no outbound HTTP" is a claim about is WConvert's own code**, and that is
the same scope `wp_mail()` has always carried: a site whose mail leaves through
an API plugin makes an HTTP call, and it makes it because the site decided to
send mail. MailPoet sending its own signup-confirmation email through whatever
transport the merchant configured is that case exactly. Free has no account, no
key, and nothing of its own to call.

## Why the push does not call `subscribeToLists()`

That is the obvious method, it is on the documented API, and it is wrong here.
Its own body:

```php
if ($subscriber->getStatus() !== SubscriberEntity::STATUS_SUBSCRIBED) {
  if ($signupConfirmationEnabled === true) {
    $subscriber->setStatus(SubscriberEntity::STATUS_UNCONFIRMED);
  } else {
    $subscriber->setStatus(SubscriberEntity::STATUS_SUBSCRIBED);
  }
```

So adding a list to somebody who unsubscribed moves them **out of
`unsubscribed`** on the way past. That is the silent cross-plugin resurrection
[ADR 0022](0022-the-wsms-push-fills-blanks-and-never-mutates-state.md) exists to
refuse, and every line of its argument transfers: MailPoet gates on status at
*send* time, so declining to write one costs nothing, and asserting one revives
a person who left — invisible in both admin screens until a complaint arrives.

The status-preserving write is `SubscriberSegmentRepository::subscribeToSegments()`,
a `setPublic(true)` service in MailPoet's own container and the class
`subscribeToLists()` itself delegates the membership half to. Reaching it means
reaching past the facade, and **that is the trade**: the facade offers no way to
add a list without also writing a lifecycle state, and a Destination that cannot
honour ADR 0022 has no business shipping.

The three alternatives, and why each loses:

- **Call `subscribeToLists()` anyway.** Resurrects unsubscribers. Refused.
- **Branch on status and call it only when they are already `subscribed`.**
  ADR 0022 is explicit that *"branching on `status` to decide anything IS
  reading it"*, which ADR 0007 forbids on the capture path.
- **Add no list to an existing subscriber at all.** Then a returning visitor's
  capture does nothing, and the Destination silently stops working for exactly
  the people most likely to convert twice.

The coupling is contained the way the WSMS one is: one file
([`WpMailPoetSubscribers`](../../src/Destination/MailPoet/WpMailPoetSubscribers.php)),
everything reached by string, and one facade plus three container services —
the thing to read on the day MailPoet moves one. The public API is still used
where it can be: `getLists()` and `addSubscriber()` are `MP('v1')`, because
writing the status of somebody MailPoet has never heard of is exactly the
decision that belongs to MailPoet's own signup-confirmation setting and not to
us ([ADR 0016](0016-wconvert-never-confirms-an-optin.md)).

**The seam is shaped so the rule cannot be broken by accident.**
[`MailPoetSubscribers`](../../src/Destination/MailPoet/MailPoetSubscribers.php)
has no way to *read* a subscriber's status and no way to *write* one — no
`unsubscribe`, no `updateSubscriber`, no `setStatus`. A method absent from the
interface is a thing the adapter cannot do by accident, which is the same
posture `WsmsContacts` takes one directory over. What no fake can see is which
method of another plugin's API the real adapter asked for, so that half is
asserted at the source and again on a real WordPress.

## Membership is only ever added, and that holds at LIST scope too

This is the half MailPoet adds and WSMS does not have. A WSMS tag is an
`INSERT IGNORE` with no state in it (ADR 0023); a `mailpoet_subscriber_segment`
row **carries its own status**, so *"unsubscribe me from Offers, keep me on
News"* is a stored opinion, and `createOrUpdate()` would overwrite it.

So the push reads which lists MailPoet already holds a row for — **whatever
that row says** — and hands `join()` only the ones with no row at all.

Reading in order to decide what *not* to write is not a read of lifecycle
state; it is ADR 0022's fill-blanks rule one scope down. That ADR reads the
stored columns of a matched [[Contact]] for exactly the same purpose, and calls
the result *the owner's opinion wins*.

## Nothing is filled in on a match

> **Planned extension recorded by
> [ADR 0109](0109-integrations-share-setup-and-map-extra-answers-per-campaign.md):**
> the shared integration model gains a per-Destination update choice, but this
> MailPoet limitation still holds until a focused write path can preserve
> provenance and lifecycle state. Do not expose an unsupported Update mapped
> fields option or use the generic update method described below. This planning
> change does not claim that MailPoet can already perform the new behavior.

The one place this differs from the WSMS push, which fills a matched Contact's
empty fields.

MailPoet's only public update path, `updateSubscriber()`, rewrites `source` and
`subscribed_ip` on **every** call. Filling an empty `first_name` would therefore
also restamp the provenance of somebody MailPoet already knows — with an IP
WConvert does not have and would not store if it did
([ADR 0017](0017-no-visitor-identifier.md)), taken from whatever request
happened to run the queue.

The captured name lands where it is evidence of something: on a subscriber this
site has never seen. On one it has, the owning system's record stands.

**Completed by [0074](0074-destinations-declare-requirements-and-show-shared-usage.md):**
the optional `interest_field` setting selects an existing MailPoet custom text
field. A captured stable `interest` value is added only when creating a new
subscriber, alongside the captured name. A match or create race still leaves
all subscriber fields untouched. Settings and readiness explicitly say that
existing subscribers keep their saved details; this mapping does not introduce
an update path.

## Consequences

- **A new `SiteDependency` case**, and the enum stays closed. Adding a member is
  a code change a reviewer reads rather than a string a Destination type invents
  for itself, and [`SitePresence`](../../src/Support/SitePresence.php) then has
  exactly one thing to answer about each. With MailPoet absent the type is
  `unavailable` and never `locked` — a missing plugin is not a tier we sell
  ([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)) — and an
  unavailable type is skipped and recorded, never enqueued.
- **`connectionSchema()` is null and no [[Connection]] is ever created.** There
  is no key to paste; it is the same site and the same database. It joins the
  webhook and the lead-magnet email in the set CONTEXT.md already names.
- **`settingsSchema()` reads the provider at admin time**, which is the read
  ADR 0007 permits and expects — a list of names reveals nothing about any
  person. It is the first WConvert schema whose options come off a provider, so
  `SettingsField` grows an `options` key: `type` says what shape the value is,
  `options` says whether the server could enumerate the legal values, and the
  stored `string[]` is identical either way. A provider that cannot be reached
  sends no options and the control degrades to the text input `ids` has always
  had.
  [0074](0074-destinations-declare-requirements-and-show-shared-usage.md) also
  reads custom text-field metadata for the optional interest mapping. That
  single-select control preserves an unavailable selected field and asks for
  correction, rather than accepting an invented field or silently clearing it.
- **FluentCRM is the same shape and should follow cheaply.** It is deliberately
  not built here; a second implementation is what would tell us which parts of
  this are general.

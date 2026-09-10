# There is no visitor-facing error state; a teaser is deferred

A [[Template]]'s tree is `{ steps: [...] }` — a form step, and for a
submit-metered design a terminal success step
([`TemplateTree`](../../resources/renderer/src/types.ts)). Two questions arrive
at that shape from the competitor survey, they look like one question, and they
have opposite answers.

**An error step is refused, permanently and on principle.** **A teaser is
deferred**, scoped to two [[Display Type]]s, with the condition it will be
measured against written down.

## The market evidence is thinner than it first reads

Of eighteen competitors surveyed, a **teaser** — the small persistent thing a
visitor taps to bring a dismissed Optin back — appears in **three**: Claspo,
Poptin, Omnisend. A visitor-facing **error state** appears in **one**: Claspo.

One of eighteen is not a pattern. It is worth understanding rather than
counting, though, because the reason Claspo has one is a difference in the model
rather than a difference in taste.

## Why Claspo can have an error and WConvert cannot

In Claspo the push to the email service provider **is** the capture. There is no
local row: the visitor's address exists in Claspo only as far as it exists in
Mailchimp. So a Mailchimp outage is a capture failure, the visitor genuinely did
not get on the list, and telling them so is honest.

WConvert inverted that before it had a first release.
[ADR 0007](0007-destinations-are-outbound-and-fallible.md) defines a
[[Destination]] as **outbound and fallible** — "it can fail without the capture
failing" — and the local [[Lead]] log is deliberately *not* one, because it is
"written first and always, and if it fails the capture itself failed."
[ADR 0008](0008-delivery-state-is-destination-health-not-per-lead.md) then put
every push behind a queue with retries and a bounded failure ring, none of which
the visitor is in a position to wait for.

So work out what a visitor-facing error could actually mean here:

- **The ESP push failed?** The Lead is in `wconvert_leads`. The job is queued and
  will be retried five times with backoff. The capture is safely recorded;
  this does not establish a Contact's subscription status in the ESP. Telling
  them the capture failed is false, and it invites them to submit again —
  producing a second Lead, because Leads are never deduplicated
  (`CONTEXT.md`, Lead).
- **The local write failed?** Then the database is down, or the plugin is broken,
  or the REST route is 500ing. That is not a state in the visitor's journey; it
  is an **outage**. The design that reports it is a `fetch` that rejected and a
  message beside the button — which is error *handling*, and belongs to capture,
  not a third step in the merchant's design.

A step is a thing the merchant lays out, styles with tokens, writes copy for,
and previews in the builder. Giving them one for a state that only exists when
the plugin is broken asks them to design their own outage page — and the
[[Playbook]] library would have to ship copy for it, in every language, for a
screen nobody should ever see.

## What was on the table, and why "it is only additive" is not the argument

The tempting reply is that adding it later is free.
[`TemplateTree`](../../resources/renderer/src/types.ts) is `{ steps: [...] }` —
an object with a named key rather than a bare array — so an `error?` key is
**purely additive**, and a snapshot taken today simply carries none. That is
true, and it is why this is not a migration decision.

It is exactly what makes writing the refusal down necessary. The cost is not the
schema; the cost is that "should the popup show an error if the ESP is down?"
sounds so reasonable that a future session says yes to it in an afternoon, and
the thing that arrives is a design surface for an outage plus a code path that
lies to the visitor whenever the retry would have worked.

## The teaser is a different question and stays open

A teaser is not an outage. It is a visitor who dismissed something and might
want it back, which is a real journey state — and it interacts with a rule this
project already has: `stopAfterDismiss` defaults **on**
([ADR 0017](0017-no-visitor-identifier.md)), so a dismissal is currently final.
A teaser is the affordance that makes it not final without making it annoying.

Two facts already in the model scope it before anything is built:

- **It is meaningless for `inline`.** An inline Optin renders where it was
  embedded and never competes for the screen (`CONTEXT.md`, Display Type). It is
  already on the page; a small thing you tap to reveal it *is* the page.
- **It is meaningless for `floating_bar`.** A bar is already the small
  persistent thing at the edge of the viewport. A teaser for a bar is a bar for
  a bar.

So it is `popup` + `slide_in`, and both live in the popover top layer
([ADR 0011](0011-non-modal-overlays-use-the-popover-top-layer.md)) — which means
it cannot be designed before
[#34](https://github.com/navidkashani/wconvert/issues/34) gives `slide_in`
somewhere to live. It is deferred to there, and the condition it is judged
against is **the payload budget measured at that point**, not a guess made now.

## Consequences

- **No `error` key, ever, and the refusal is the record.** A request for one is
  answered here rather than re-argued. Where a capture genuinely fails, the
  visitor sees an error *beside the button* from the capture path — the browser
  telling them the submission did not go through — and never a step of the
  merchant's design.
- **A Destination failing is invisible to the visitor by construction**, which
  is ADR 0007's clause followed all the way through. It is visible to the
  *merchant*, on Destination health and in the failure ring, which is where an
  outage is actionable. ADR 0007 carries the inline note.
- **The teaser question is reopened by
  [#34](https://github.com/navidkashani/wconvert/issues/34)**, scoped to `popup`
  and `slide_in`, and measured against the payload budget as #34 leaves it.
  `tests/unit/Frontend/PayloadBudgetTest.php` is the number.
- **`steps[]` stays an object with a named key.** It was already, and that is
  now load-bearing for a reason: it is what makes the deferred half of this
  decision cost nothing to defer.
- `CONTEXT.md`'s [[Destination]] entry gains the sentence, since the definition
  was carrying it silently.

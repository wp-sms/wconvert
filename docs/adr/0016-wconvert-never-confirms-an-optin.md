# WConvert never confirms an opt-in

WConvert has **no double opt-in, no confirmation email, and no confirmation
lifecycle** — in any install shape, free or [[Pro]], standalone or integrated. A
[[Lead]] is written once and is never later confirmed, verified or activated.

This is not a deferral. There is no v2 in which WConvert grows one.

## Why

**A confirmation flow is a lifecycle, and the lifecycle is the drift signal.**
`CONTEXT.md` names any feature that gives a Lead a lifecycle as the moment
WConvert starts becoming a second contact database, and
[ADR 0002](0002-leads-are-immutable-by-schema.md) removed `status` and
`updated_at` from `wconvert_leads` so that the schema enforces it rather than a
comment. "Confirmed" is a status. Building double opt-in means putting both
columns back.

**It contradicts the Destination contract.** [ADR 0007](0007-destinations-are-outbound-and-fallible.md)
made data flow one-way at capture time: WConvert never reads [[Contact]] state
back and never has an opinion about who is subscribed. Confirming an opt-in is
reading *and* mutating exactly that state. Owning double opt-in would not bend
that rule, it would delete it.

**For four of five [[Destination]]s it would be double double opt-in.**
Mailchimp, MailerLite and Brevo all carry double opt-in as an audience-level
setting. A confirmation from WConvert followed by a confirmation from the ESP is
two emails asking the same question, and the second one arrives looking like a
mistake.

## Delegating to WSMS was investigated and does not work

WSMS's double opt-in is a **code-entry verification bound to a live form
session**, not a link click: `SubscriptionHandler::sendVerification()` calls
`VerificationService::sendCode()`, stashes the contact id in a transient keyed by
a session token, and returns `SubmissionResult::pendingVerification()` so the
form UI can render a code input. `SubscriptionHandler::verify()` is the only
transition out of `pending`.

A queued cross-plugin push has no form session and no code input, so it cannot
reach that path. This is what makes the seam decision on
[#5](https://github.com/navidkashani/wconvert/issues/5) wrong rather than merely
incomplete.

## Consequence: #5's `pending` becomes `subscribed`

**#5 is amended.** The WSMS push must create contacts with status
`subscribed`, not `pending`.

`pending` looked conservative and is in fact a dead end. Nothing in WSMS can move
a WConvert-created contact out of it, no admin screen offers to, and
`ContactRepository::eachKeyset()` resolves campaign audiences with
`status = 'subscribed'` — so every Lead WConvert pushed would be permanently
invisible to every WSMS campaign, silently, with the merchant seeing a growing
contact list that never receives anything.

`subscribed` is also the honest reading: the visitor typed their address into a
form whose consent copy said what it was for, which is the same evidence WSMS's
own single-opt-in forms act on.

## Consequences

- **Standalone genuinely has no double opt-in, and that is correct.** Nothing in
  a [[Standalone]] install ever sends marketing to a Lead — the Lead log is a
  log. The one thing that does send, the lead-magnet delivery email, is
  transactional fulfilment of a request the visitor just made.
- **A merchant who requires confirmed opt-in on WSMS uses WSMS's own
  subscription form.** Say this in the docs. Half-building a confirmation flow
  that only works on one Destination is worse than not having one.
- **Do not add a "resend confirmation" admin action.** It is the same feature
  wearing a hat.
- The consent evidence WConvert *does* keep is the [[Consent Record]] snapshotted
  onto the Lead at capture — see
  [ADR 0032](0032-consent-capture-is-first-class-in-the-template.md) for how it is
  captured and
  [ADR 0018](0018-erasure-deletes-rather-than-anonymises.md) for what happens to
  it under an erasure request.

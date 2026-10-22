# 0164: Codes and resource links arrive with the capture reply

Accepted 2026-10-22. Amends 0003, 0004, 0080 and 0152. Issue #323.

Every published campaign prints its whole design into the page, thank-you
screen included: the payload is the published config (ADR 0003), inlined as a
JSON tag (ADR 0004). A visitor who opened the page source could read a
signup coupon, or a lead magnet's file address, without signing up. #322's form
switch makes "sign up to get the code" common, so this now matters.

## Decisions

**1. Codes and resource links only.** This held set is the signup's
**reward**. On a step the visitor can reach only after the primary submission,
every `code` loses `text` and `apply_href`, every
`followup` loses `href`, and each is printed `hidden: true`. Headings, body text
and layout stay in the page. The rule for "after the primary submission" is the
one that already places a `followup`: steps after the primary submit screen in a
linear design, and screens no route reaches without passing it in a graph
(`GraphCaptureContract::bypasses`). A code on the optional second signup's
screen is held too. A code before the form, and any design with no form, is
printed as before: it is meant to be seen. ~~Where the primary submission is
optional (a result-first quiz), nothing is held, because skipping it reaches
every later step without signing up.~~ *Amended the same day: it is held there
too, and a visitor who skips the signup sees the thank-you screen without it.
The code is the reason to sign up, which is how Octane AI gates a quiz discount
on its opt-in; a code meant for everyone belongs on the result, before the form.
The editor says so on a code placed after an optional signup.*

**2. The primary submission's reply carries them.** `JourneyCapture` adds
`reward: { "<stepId>": [ {text, apply_href?} | {href} | null ] }` to the primary
submission's accepted reply and to its replay, so a visitor whose first reply was
lost still gets it. The optional signup, a refusal and a challenge carry none.
It is read on each request from the published tree, so nothing is stored.

**3. Addressed by position, with nulls.** Nodes have no ids. Each step's list
has one entry per `code` and `followup` in tree order; `null` marks one that is
not shown (switched off, or inside a switched-off layout), so its value leaves
the page and is never sent. The loader walks the same tree. The capture
contract fingerprints the whole layout, values included, so a cached page whose
positions or code differ is refused as changed (409) before it is rewarded, until
the page cache is cleared (ADR 0150).

**4. Held at output, not in storage.** `PayloadTag::render()` applies
`HeldReward::printed()` when there is a capture URL. The stored published set keeps
every value, so `CouponLink` (ADR 0152), the contract fingerprint and the
Inspector's server side are unchanged. A draft preview has no capture URL and
shows the full design.

**5. The loader fills before it draws.** `fillReward()` (`loader/src/reward.ts`)
writes the values into the tree the mount re-renders from and un-hides those
nodes, just before the next screen is shown, in Free's journey and Pro's. A
reply with no reward leaves them hidden: a blank code is never drawn or copied.
It cost Free 71 B and Pro 57 B gzipped, inside both budgets (ADR 0029).

## What this does not hide

- **Plain text.** A code typed into a heading or paragraph is still in the page.
- **Quiz results.** Pro's result variants (heading, body, link, products) stay
  public; a result is the answer to the quiz, not a reward for signing up.
- **Content lock.** The locked region's HTML is in the page (ADR 0102).
- **A made-up address.** The code is behind a signup, not a verified email
  (ADR 0073). Anyone may sign up as anyone, at the capture rate limit (60 per
  10 minutes per IP).
- **One code for everyone.** It is still the same static code for every visitor.
  Per-visitor codes would plug into this reply later; nothing here mints one.

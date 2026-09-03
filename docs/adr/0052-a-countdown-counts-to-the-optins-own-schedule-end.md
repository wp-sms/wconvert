# A countdown counts to the Optin's schedule end, and to nothing else

A `countdown` node carries no `until`, no `minutes`, and no `evergreen` flag. It
counts to the [[Optin]]'s `ends_at` — the same instant that decides whether the
Optin is on the page at all — and there is nowhere to put a second deadline.

Two arguments arrive at that from opposite directions and neither is the usual
one about scope.

## WCAG 2.2.1 settles the fixed/evergreen split, at Level A

**A countdown that expires an offer is a time limit** under SC 2.2.1 *Timing
Adjustable*, which is **Level A** — the lowest bar there is, and this project
holds itself to 2.1 AA
([ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md)). A time
limit must offer turn-off, adjust or extend, **unless it is a real-time event**
whose nature does not allow extra time.

That exception lands exactly on the split:

- **A fixed deadline bound to `ends_at` is a real calendar moment the merchant
  set**, at which the campaign genuinely stops. That is the real-time-event
  exception in the same shape as an auction closing, and it needs no controls.
- **An evergreen per-visitor countdown is a manufactured limit.** It is not a
  real-time event, so it would need turn-off/adjust/extend to reach Level A —
  which is incompatible with what the feature is for.

## The European Accessibility Act makes that the merchant's exposure

In force since **28 June 2025**, requiring WCAG 2.1 AA (2.2 in practice) for
e-commerce selling into the EU above roughly 10 employees and €2m turnover. All
27 member states have transposed it; the first lawsuits were filed in France in
November 2025.

This plugin injects UI into somebody else's page: **our markup, their
liability.** A merchant does not audit a popup's timer against SC 2.2.1, and
they should not have to — a plugin that made the non-compliant version the easy
one would be handing them a risk they cannot see.

## And the trust reading arrives at the same answer

*"A deadline with no consequence is just a clock."* An offer that keeps working
after zero teaches shoppers the urgency is decoration, and a timer that resets
on refresh is the single fastest way to teach it. OptinMonster and Thrive both
keep the timer and the schedule as **independent** settings, which is precisely
how a merchant ends up with a countdown that has expired on a campaign that has
not.

Binding them makes the zombie countdown **unexpressible** rather than a setting
somebody can misconfigure — the same move as `overlayDone` being set on show.
At `ends_at` the Optin leaves its window, shows nothing and records no
Impression, so the deadline gets a real consequence for free.

## What that buys, mechanically

Scheduling ([ADR 0050](0050-a-scheduled-optin-stays-in-the-published-set.md))
had already solved the hard half. The merchant authors a **local wall time**,
[`Schedule.php`](../../src/Optin/Schedule.php) resolves it once on the server
against `wp_timezone()`, and the payload carries **one absolute instant in
milliseconds** the loader compares to `Date.now()`.

That is exactly a cache-proof countdown target, and the classic implementation
bug in this genre is not expressible here: a server-rendered seconds-remaining
value baked into a cached page is wrong for every visitor after the first. There
is no such value to bake.

It also costs nothing new anywhere:

- **No stored field and no control.** `HowOften.tsx` already edits `ends_at`.
- **No second timezone conversion**, and no way for a timer and a schedule to
  disagree.

## The renderer stays pure, because the tick is not in it

`render()` draws a countdown's SHAPE and no time at all — it asks nothing of the
world it will be attached to, including what the time is. The tick lives in
`mount()`'s `shell()`, which every container shares.

That is what closes the objection this feature was parked on: the admin rebuilds
its preview on **every keystroke** and the gallery mounts one preview per card,
so a naive interval leaks one per letter and one per card. **No teardown handle
had to be invented** — every container already has a `close()` that the loader
and `Preview`'s effect cleanup both call, so the tick is stopped where the mount
ends. An Optin with no `ends_at` starts no interval at all.

## Accessibility of the display itself

`role="timer"` carries an implicit `aria-live="off"`, so a ticking display does
not announce every second — which both obvious alternatives do:
`aria-live="polite"` on a value that changes once a second queues an
announcement a second, and `role="status"` is `aria-live="polite"` under another
name. It is named, marked `aria-atomic` so what is read is the whole time rather
than the digit that changed, and nothing escalates to `assertive`: an offer
expiring is not an emergency.

## The state that is left, and where it is reported

Binding the deadline leaves exactly one way a countdown can be wrong: a design
carrying a clock on an Optin with **no end date**. It renders, saves and
publishes, and the clock is empty.

That is a builder problem rather than a crash, and it is a fifth entry in
`builder/structure/problems.ts` — which reports what is wrong as sentences with
a way to the block. The fix is on a **different tab** from the design, so the
sentence names it.

## Evergreen stays refused, not deferred

It was previously parked on bytes and on wall 3 — every visitor gets
byte-identical HTML, so a per-visitor deadline has to be stored in the browser.
The byte argument is gone (ADR 0014, amended) and the storage ladder exists
(`wcv1`), so what remains is the two arguments above, which are not about cost.

Had it shipped, it would also have needed a decision nobody has made: **is
remembering a deadline `functional`, like remembering a dismissal, or does it
need consent?** That question does not need answering, because the answer to the
feature is no.

*"Store the deadline itself, never a key pointing at one"*
([ADR 0017](0017-no-visitor-identifier.md)) is the shape it would have to take
if this is ever reopened. It is written down here so that reopening it starts
from the right place rather than from a key in `localStorage`.

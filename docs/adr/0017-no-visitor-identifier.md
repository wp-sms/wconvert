# WConvert mints no visitor identifier

**WConvert never generates, stores or transmits a per-visitor identifier.** No
visitor id cookie, no device id, no hashed fingerprint, and no id on an analytics
beacon. Per-visitor state exists, but it is the *record itself* — which Optins
this device has seen and dismissed — never a key pointing at a record.

## What this overturns

The [#9](https://github.com/navidkashani/wconvert/issues/9) loader prototype
mints one. `src/loader.js:78-86`:

```js
function visitorId() {
  if (!consentGiven()) return null;
  let id = readCookie(COOKIE);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    document.cookie = COOKIE + '=' + id + ';path=/;max-age=31536000;SameSite=Lax';
  }
  return id;
}
```

Its own comment says "not to identify anybody". A persistent random per-device
value with a one-year lifetime is an identifier whatever it is called, and it is
precisely the artefact the CNIL refused to exempt when the advertising industry
asked for frequency-capping cookies to be added to the exempt list — while
listing user-interface preferences as exempt.

## The real fault is that one cookie did two jobs

| Job | Category | Needs a stable id? |
|---|---|---|
| Fallback store for frequency capping when `localStorage` is blocked | `functional` | **No** — it needs somewhere to put the record |
| Dedup key for [#12](https://github.com/navidkashani/wconvert/issues/12)'s beacons | `statistics` | Yes |

Merging them made a functional value inherit the stricter category, and made a
free plugin write a tracking identifier to serve a metric nobody had asked for
yet. Split, the first job is satisfied by a cookie holding the dismissal record
directly — a few bytes, per-Optin, non-identifying — and the second job is
dropped.

## What #12 loses, and what it keeps

Beacons go **stateless**. Impressions, conversions, dismissals and therefore
conversion rate are all counts and need no identity. What is lost is unique
visitors, and "3 impressions" becoming indistinguishable from "1 visitor who saw
it 3 times" in the rollup.

That is the right trade for a free wp.org plugin. The alternative buys one
secondary metric with a persistent identifier on every install in the EU, and
with it a retention obligation, an export surface and an erasure surface for a
value that identifies a browser rather than a person.

## Consequences

- **[#12](https://github.com/navidkashani/wconvert/issues/12) may not reintroduce
  one.** If unique-visitor metrics are wanted later, they arrive as a Pro feature
  gated on `statistics` consent — never as a core default.
- **`Math.random()` would have been the wrong generator anyway.** Noting it so
  nobody "fixes" this ADR by reaching for `crypto.getRandomValues()`; the
  objection is to the identifier, not to its entropy.
- **The client state that remains holds no personal data**, which is why the
  personal-data eraser cannot and need not reach it. An eraser that could reach a
  visitor's device would be a worse plugin.
- Free's per-visitor storage is therefore entirely `functional`: it records a
  choice the visitor made by clicking the close button, and withholding it means
  the popup reappears — worse for the visitor on every axis.
  *Completed by [#22](https://github.com/navidkashani/wconvert/issues/22), which
  built it: the record is `{impressions, last-seen, dismissed, converted}` per
  Optin, and **last-seen is a whole day number rather than a timestamp**. A
  cooldown is expressed in days, so millisecond precision is a resolution nothing
  ever asks about — and a per-device value at millisecond precision is most of the
  way back to the artefact this ADR removed. The prototype's `firstSeenAt` is gone
  with it, having had no reader.*

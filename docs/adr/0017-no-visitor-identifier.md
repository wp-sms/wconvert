# WConvert mints no visitor identifier

**WConvert never generates, stores or transmits a per-visitor identifier.** No
visitor id cookie, no device id, no hashed fingerprint, and no id on an analytics
beacon. Per-visitor state exists, but it is the *record itself* — which Optins
this device has seen and dismissed — never a key pointing at a record.

*The "record itself" distinction has a third caller, and the first one that is
Pro's: [ADR 0045](0045-an-ab-variant-is-a-whole-optin.md) resolved A/B
assignment to `wcv1[parentId].v`, a field on the per-Optin record naming the
arm this browser drew. It is read against this sentence and passes — an arm of
one experiment is not a key pointing at a visitor — and the consequence, that
the split unit is the browser record and not the person, is accepted there
rather than repaired with an id. The consequence below about **free's** storage
is unchanged: this field is written by Pro's loader.*

*Built by [#93](https://github.com/navidkashani/wconvert/issues/93), and it is
one notch less than even that paragraph allowed for: **what is stored is the
arm's INDEX, not its id.** A small integer, drawn once, joining to nothing and
expiring with the record — the same reasoning that made `l` a whole day number
rather than a timestamp, applied to a value that could have been 26 characters
of ULID and had no need to be. And the consequence is stated where a merchant
reads the result:
[ADR 0058](0058-a-test-ends-when-the-merchant-says-so.md) puts one sentence on
the Optins list saying the numbers count browsers rather than people, drawn
only where a test is running, because a product that cannot honestly count
people must say so on the screen that reports the number.*

*The fourth caller read against this sentence and **declined to store anything
at all**: [#91](https://github.com/navidkashani/wconvert/issues/91)'s `referrer`
Condition. The obvious version of that feature is a FIRST-TOUCH source — "they
originally arrived from Google" — which needs the first referrer held across
page views, and a per-visitor fact with a lifetime is the shape this ADR
refuses whether or not it carries an id. So the Condition reads
`document.referrer` at the instant a Trigger fires and drops it: **one hop, no
storage, no consent category**. The authoring surface says so in the merchant's
own words, because the mis-reading is the feature request
(`resources/admin/src/builder/controls.tsx`), and
`pro/tests/js/pro-modules.test.ts` asserts it on the WRITE rather than on the
declaration — the assertion that fails on the pull request that starts caching
a source, rather than on the one that forgets to update a comment.*

*The fifth caller is the one that had the most obvious excuse to mint one and
had no use for it either.
[ADR 0057](0057-a-milestone-is-a-date-recorded-once-about-the-site.md)
instruments activation through first conversion, and **every one of its five
milestones is a fact about the SITE** — two days, a [[Playbook]] id and one of
five words. "Record once" is the shape of a funnel and reads like a reason to
key something by a person; it is not. There is no visitor id, no Optin id and
no user id in `wconvert_milestones`, and the check is written the way
`bin/verify-stats.php` writes the address one — plant everything a request
carries, drive the real path, and read the stored value back looking for it.*

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
  *Held by [#26](https://github.com/navidkashani/wconvert/issues/26), which built
  the beacon and reintroduced nothing. What travels is
  `{optin_id, kind}` — an id that is already public in the page's payload, and
  one of three words — with no timestamp either, because the day is stamped from
  the SERVER's clock and a client-supplied date on a public endpoint is a date
  anyone can choose. The consequence is followed through: there is **no consent
  gate on the beacon at all**, because there is nothing there a gate would be
  protecting. The rate limit is the one place an address is touched, and it is
  hashed with `wp_hash()` into a transient key and stored nowhere — asserted by
  reading back the whole options table in
  [`bin/verify-stats.php`](../../bin/verify-stats.php).*
- **`Math.random()` would have been the wrong generator anyway.** Noting it so
  nobody "fixes" this ADR by reaching for `crypto.getRandomValues()`; the
  objection is to the identifier, not to its entropy.
- **The client state that remains holds no personal data**, which is why the
  personal-data eraser cannot and need not reach it. An eraser that could reach a
  visitor's device would be a worse plugin.
- Free's per-visitor storage is therefore entirely `functional`: it records a
  choice the visitor made by clicking the close button, and withholding it means
  the popup reappears — worse for the visitor on every axis.
  *Extended to a second scope by
  [ADR 0047](0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md),
  and this sentence is the reason it lands in the same category. The site-wide
  allowance is **the same four fields held once for the whole site** rather than
  once per Optin — so it records the same act read more broadly, and withholding
  it makes the visitor meet six different Optins across six pages instead of
  one. It is in fact **less** identifying than the state it sits beside: four
  values in total, saying nothing about which campaigns this device has met. The
  claim above is now about a second SLOT and not a second key, which is why it is
  noted here rather than only there.*
  *(Corrected: this read "about two keys and not one", inherited from ADR 0047's
  original diagram. There has only ever been one persistent key — `wcv1` — and
  the site-wide allowance is a reserved entry inside it,
  [`SITE_SLOT`](../../resources/loader/src/state.ts), under a name no ULID can
  take. Same ladder, same fail-open, no second consent call.)*
  *Built by [#92](https://github.com/navidkashani/wconvert/issues/92), and the
  one thing that had to be decided at the write rather than at the read: **the
  slot is filled only where the site has an allowance to spend.** All four
  fields are off at that scope until a merchant asks, so a site that has asked
  for nothing writes exactly the bytes it wrote before this shipped — which is
  what makes "an upgrade changes nothing about what a live site does" a property
  of `shell.ts` rather than of the reasoning around it.*
  *Completed by [#22](https://github.com/navidkashani/wconvert/issues/22), which
  built it: the record is `{impressions, last-seen, dismissed, converted}` per
  Optin, and **last-seen is a whole day number rather than a timestamp**. A
  cooldown is expressed in days, so millisecond precision is a resolution nothing
  ever asks about — and a per-device value at millisecond precision is most of the
  way back to the artefact this ADR removed. The prototype's `firstSeenAt` is gone
  with it, having had no reader.*
  *And the sentence above is what settled a default #3 left open:
  **`stopAfterDismiss` is ON unless a merchant turns it off**, where the prototype
  had it off. Off by default, the record is written, read, and ignored — the popup
  reappears anyway, and the justification for writing anything to a visitor's
  device collapses. It is now symmetric with `stopAfterConversion`, which was
  always on: both record something the visitor DID, and both mean stop. The two
  numbers, `maxImpressions` and `cooldownDays`, stay off — those are a merchant's
  pacing decision rather than a visitor's answer.*
  *That ON default is **per Optin only**.
  [ADR 0047](0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md)
  ships all four **off** at site scope, which is a deliberate asymmetry rather
  than an inconsistency: the per-Optin default honours a visitor saying "stop
  showing me **this**", which costs the merchant nothing they did not accept by
  putting a close button on it, while the site default would read the same click
  as "stop showing me **anything**, for a week" — a claim about what the visitor
  meant that they did not make. OptinMonster ships both of its global cookies
  off for the same reason.*

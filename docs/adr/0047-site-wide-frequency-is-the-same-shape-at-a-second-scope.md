# Site-wide frequency is the existing Frequency shape at a second scope

A visitor who browses six pages can currently meet six different [[Optin]]s.
WConvert shows at most one overlay **per page view**
([`decide.ts`](../../resources/loader/src/decide.ts)), and that guarantee resets
on every load — which is exactly what the WordPress support-topic evidence
complains about, in the words merchants actually use: *"it keeps popping up"*.

The fix is **the four fields [[Frequency]] already has, held once for the whole
site**, in one more slot of the storage key the loader already writes, in the
`functional` category, with both switches **off by default**.

```
TODAY   localStorage['wcv1'] = { "01HA…": { i, l, d, c } }
AFTER   localStorage['wcv1'] = { "01HA…": { i, l, d, c },
                                 "site":  { i, l, d, c } }   the same four fields, one reserved slot
```

*Corrected. This diagram originally read `wc_o_01HA` and `wc_site`, as though
the loader kept one `localStorage` key per Optin and would gain a second kind
alongside them. **It has never had either.**
[`state.ts`](../../resources/loader/src/state.ts) has exactly one persistent
key — `STATE_KEY = 'wcv1'` — holding a map of Optin id to record, and grepping
the repository for `wc_o_` or `wc_site` returns prose and nothing else. The
notation spread from here into [ADR 0017](0017-no-visitor-identifier.md),
[ADR 0045](0045-an-ab-variant-is-a-whole-optin.md), `CONTEXT.md` and the bodies
of two unbuilt tickets, which is how a diagram becomes a specification. The
site-wide allowance is a **reserved key inside `wcv1`** — a name no ULID can
take, `site` being the obvious one — and not a second key, so it costs no
second read, no second write and no second entry on the
`localStorage → cookie → in-memory` ladder.*

*And the key carries its own version, which is why this is the least urgent of
WConvert's four storage layers. A change to this shape that cannot be made
compatible is a bump to `wcv2`: old records are abandoned rather than migrated,
every visitor looks new once, and a frequency cap is precisely the kind of state
that can afford that. The server's three tables, its seven options and the
published set have no such escape hatch, which is where the pre-release audit
spent its attention instead.*

## No new vocabulary is needed, and that is the finding

OptinMonster ships exactly two site-wide rules: a **global interaction cookie**
(the visitor closes any campaign, nothing shows for N days) and a **global
success cookie** (the visitor converts on any campaign, nothing shows for N
days). `0` disables either, and a campaign's own cookie overrides the global one
where it is more restrictive.

Read those two against
[`Frequency`](../../resources/loader/src/types.ts) and they are not new rules.
They are `stopAfterDismiss` and `stopAfterConversion` **asked at site scope**.
The numbers beside them — `maxImpressions` and `cooldownDays` — are the same
question again: how many overlays this visitor meets across the site, and how
long after the last one before another may.

Thrive Leads is the other half of the same picture. It orders Lead Groups by
drag-and-drop and shows only the highest match — which is
[`decide.ts:192`](../../resources/loader/src/decide.ts)'s `priority` sort,
already built, already deterministic, already tie-broken by id.

So the gap is not a missing model. It is one scope missing from a model that has
everything else.

*Amended by [ADR 0048](0048-the-eligibility-inspector-runs-on-the-real-page.md), which
landed the rules panel this ADR's scope sits inside: **the
per-Optin authoring surface this ADR assumed already existed has now landed**,
and it did not exist when this was written. `frequency.ts` had honoured all four
fields since #3 and `priority` had been sorted on since the engine was built —
and **nothing had ever written either**. No control produced them, and
`OptinController::normalizeConfig()` validated `targeting`, `rules`,
`destinations` and `template` and let `frequency` and `priority` through as
unvalidated passthrough out of the config blob. Every merchant Optin shipped
uncapped and unprioritised.*

*The author is `builder/rules/HowOften.tsx`, the fourth of the rules panel's
four sections; the normaliser is **`src/Optin/Frequency.php`**, and it is the
shape this ADR's second scope reuses rather than re-derives. That is why it is a
file rather than six lines in the REST controller: the site-wide surface is not
a REST controller, so a normaliser inlined in one would have been rewritten the
day this ADR shipped.*

*Followed by [ADR 0050](0050-a-scheduled-optin-stays-in-the-published-set.md),
which put `src/Optin/Schedule.php` beside `Frequency.php` on this paragraph's
authority and before it cost anything — a schedule is the same shape of value
with the same non-REST author coming. It also shares the section: an Optin's
window is authored in `HowOften.tsx`, because the allowance is how often ONE
visitor may meet a campaign and the window is when the campaign is on at all.
Where the two part company is the refusal: `Frequency` drops a nonsensical
count to null, and `Schedule` THROWS on an end before its start, because
dropping either boundary publishes a decision the merchant did not make.*

*One decision inside it is worth carrying forward. **`true` is never stored.**
Both switches default on because `frequency.ts` tests `!== false`, so an absent
key and a stored `true` are the same answer to the engine and only one of them
costs bytes on every matching page view. The site-wide key should be written the
same way.*

## Why it is `functional`, and why that is not a loophole

[ADR 0017](0017-no-visitor-identifier.md) put per-Optin frequency state in
`functional` on one argument: *"it records a choice the visitor made by clicking
the close button, and withholding it means the popup reappears — worse for the
visitor on every axis."*

The site-scope key records the same act, read more broadly. Withholding it makes
the visitor's experience strictly worse in the same direction: they closed
something, and the site behaves as though they did not — six times instead of
once. There is no reading under which a stricter category protects this visitor.

The three properties ADR 0017 actually cares about all hold, and they are worth
checking one at a time rather than asserting:

- **It is not an identifier.** It is the record itself — four small values,
  none of which names anybody — which is the distinction that whole ADR turns
  on.
- **It carries no more precision than the question needs.** `l` is whole days
  since the epoch, because a cooldown is expressed in days. A per-device value
  at millisecond precision is most of the way back to the artefact ADR 0017
  removed.
- **It is one more slot, not a new kind of thing.** *(Corrected: "one more
  key". It is a reserved entry inside `wcv1`, which is the loader's only
  persistent key — see the diagram above.)* It goes through the same
  `localStorage → cookie → in-memory` ladder, failing open
  ([`storage.ts`](../../resources/loader/src/storage.ts)), because a visitor
  with both stores blocked seeing an extra popup is annoying and a visitor
  seeing nothing is broken.

The site key is *less* identifying than the per-Optin state it sits beside: it
is four values total rather than four per Optin, so it says nothing about which
campaigns this device has met.

## Both switches default OFF, which is the opposite of the per-Optin default

`stopAfterDismiss` and `stopAfterConversion` default **on** per Optin
(ADR 0017), and it would be tidy for the site scope to match. It must not.

*One dismissal silences the entire site for a week* is a very large hammer, and
a merchant who has not asked for it would experience it as the plugin having
stopped working — with nothing on any screen to explain why, because the reason
is a decision they never made. OptinMonster ships both global cookies off for
the same reason, and it is the one place their defaults and ours diverge on
purpose.

The asymmetry is coherent rather than inconsistent. The per-Optin default is
about **one** thing the visitor closed: they said stop showing me *this*, and
honouring it costs the merchant nothing they did not already accept by putting a
close button on it. The site default is about **everything**, which is a claim
about what the visitor meant that they did not make.

## How the two scopes compose

Site scope is checked **first**, and it is a veto, not a vote. If the site
allowance is spent nothing shows, whatever any individual Optin's own Frequency
says. An Optin cannot opt out of the site-wide rule — that would be a per-Optin
setting called *ignore the site setting*, which is the configuration this exists
to delete.

That lands it in one place in the decision: alongside `isAllowed`, before any
rule is evaluated, producing the `capped` standing that already exists and
already means *the allowance is spent, and this cannot change on this page
view*. The eligibility inspector therefore explains it for free, in the words it
already uses.

**It is a `capped`, not a new state.** A seventh member of `Standing`
distinguishing "capped by this Optin" from "capped by the site" is the thing to
resist: it widens a vocabulary the whole design keeps closed, to carry a
distinction the inspector can render as a sentence beside the one word.

*Applied a second time by [ADR 0050](0050-a-scheduled-optin-stays-in-the-published-set.md),
to a distinction that is not about frequency at all. An [[Optin]] outside its
scheduled window is `capped` — same word, same reasoning, same consequence that
the page is not held live — and what tells the merchant "it starts on Friday"
is a **gate in the inspector's funnel**, which is that screen's vocabulary
rather than the engine's. That this argument transferred whole to an unrelated
feature is the evidence for it that this ADR could not supply on its own.*

## Consequences

- **No new storage key at all, one consent call, no schema change.** *(This
  said "one storage key". There is already exactly one — `wcv1` — and the
  allowance is a reserved slot in it.)* The setting itself is
  a WordPress option, the way
  [`RetentionPeriod`](../../src/Retention/RetentionPeriod.php) is — a
  site-wide decision has no Optin to hang on, which is the argument
  `CONTEXT.md` already makes for the [[Retention Period]] and makes again here.
- **Defaults off**, so an upgrade changes nothing about what a live site does
  until a merchant asks it to. That is the same posture retention pruning takes,
  and for the same reason.
- **`functional`, and ADR 0017 carries the inline note**, because its
  "free's per-visitor storage is therefore entirely `functional`" consequence
  now covers a second key and would otherwise read as a claim about one.
- **Site scope is a veto and produces `capped`.** No new standing, no per-Optin
  override, no seventh word.
- `CONTEXT.md` gains [[Frequency]] as a term, because it now has two scopes and
  a term with two scopes is one nobody will spell the same way twice.

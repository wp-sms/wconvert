# Site-wide frequency is the existing Frequency shape at a second scope

A visitor who browses six pages can currently meet six different [[Optin]]s.
WConvert shows at most one overlay **per page view**
([`decide.ts`](../../resources/loader/src/decide.ts)), and that guarantee resets
on every load — which is exactly what the WordPress support-topic evidence
complains about, in the words merchants actually use: *"it keeps popping up"*.

The fix is **the four fields [[Frequency]] already has, held once for the whole
site**, in one more storage key, in the `functional` category, with both
switches **off by default**.

```
TODAY   wc_o_01HA = { d, c, i, l }   per Optin, dismiss + convert default ON
AFTER   wc_site   = { d, c, i, l }   the same four fields, one extra key
```

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

*Amended by the pull request that split the rules panel into four sections: **the
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
- **It is one more key, not a new kind of thing.** It goes through the same
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

## Consequences

- **One storage key, one consent call, no schema change.** The setting itself is
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

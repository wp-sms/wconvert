# Halloween collection review

Reviewed 21 October 2026. Five new campaign setups reuse the five Halloween
designs already reviewed in this PR; no visitor renderer or design layout changed.

## Calendar and membership

“Prepare for Halloween” contains exactly these five setups, with `any` stage so
all remain available while merchants plan rather than hiding offer designs until
the event day. Priority 85 places this seasonal collection ahead of the existing
Black Friday collection (80) while both are relevant. It serves stores without a
country restriction and respects existing personal seasonal opt-outs.

Feature window: **1 September–31 October 2026 inclusive**. Event: **31 October
2026**. Both exclusive ends are **1 November 2026**. These are discovery dates,
not a campaign schedule. Future drafts still need the merchant's real deadline;
the countdown setup explains that it uses the campaign's end date.

This is an editorial planning window, informed by NRF's Halloween research:
https://nrf.com/research-insights/holiday-data-and-trends/halloween
NRF reports 49% of consumers start Halloween shopping in September or earlier.
The collection gives the merchant an early start without inventing a universal
sale period. It uses the current year-specific collection contract.

## Individual setup decisions

- **halloween-midnight-offer:** The orange engraved frame remains visible around
  the cream offer. At 320px the CTA wraps into two readable lines; desktop keeps
  the original centred hierarchy. Notes require a real coupon, discount and link.
- **halloween-treat-signup:** One email and explicit consent lead to an on-screen
  offer. The second screen acknowledges receipt and displays the merchant's code,
  without claiming subscription or email delivery. Both screens retain the monster
  artwork and readable central content. Actual submission validation, consent and
  retry were exercised on WordPress.
- **halloween-after-dark-offer:** The editorial headline leads to a separate offer
  panel on desktop and precedes it on mobile. The forest/pumpkins stay decorative;
  content, terms and code are editable. No lead collection is implied.
- **halloween-midnight-flight-offer:** Reuses that layout with authored bat motion
  and shorter leading copy. The bats have their own space above the offer, and
  the close control is separate. The setup notes mention the motion switch.
- **halloween-sale-countdown:** The pumpkin and single CTA stay alongside a compact
  deadline. Occupied height is 143px at 320px and 85px on desktop. The setup removes
  the prototype's hardcoded coupon string from body copy and explicitly asks for
  the merchant's real end date; the deadline remains unset in fresh drafts.

## Verification

Inspected all ten contact sheets (320px and 1440px), including the signup
acknowledgement. These show optional-font fallbacks without fetching Google.
The existing Halloween font and motion behavior was reviewed earlier in this PR.

`results.json`: all five prepared setups pass on disposable WordPress at 320px
and 1280px (10 checks), including real CTA destinations, email validation,
required consent, simulated failure/retry and local lead capture. The disposable
fixture sets the countdown deadline seven days ahead; that date is not shipped.

Layout/contrast audit: 96 normal-copy and 96 long-copy cases across eight widths,
LTR and RTL, with zero findings. Designs themselves were not modified.

These are bundled campaign setups and a bundled collection. This change does
not publish a hosted catalogue release; the existing export limits on the
Halloween backgrounds remain outside this change. Other collections' runtime
snapshots are retained; approval here covers only the new Halloween collection
and these five setup revisions.

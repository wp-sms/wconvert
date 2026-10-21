# Halloween treat with teeth: fine print off the teeth — 21 October 2026

Reviewed by Claude. Standing limits are in `tools/design-library/review/README.md`.

**Why it changed.** Once the catalogue measured contrast with the bound
background pictures (ADR 0162), `halloween-monster`'s fine print failed WCAG AA:
1.15:1 on the offer and 1.18:1 on the code screen. On both screens it sat over
the cream lower teeth (in the approved 1440 sheet the word "Offers" crosses a
tooth). The fix moves the fine print one place up on each screen: above the
button on the offer, between the body and the code on the code screen. Padding,
tokens, words and artwork are unchanged.

Making the card taller was tried first and rejected: background `cover`
scales the monster with the card's height, so the upper teeth then clip the
eyebrow.

- **halloween-treat-signup.** At 1440 and 320 the fine print now sits on the
  dark mouth on both screens, with the consent wording visible. It reads before
  the button, as a disclosure should. On the code screen, the lower teeth now
  reach the bottom corners of the dashed code box. The code itself stays on
  dark and reads clearly, and it looks like the monster holding the treat.
  The code box has no fill of its own, so covering the teeth would need a
  renderer change. At 320 the eyebrow grazes an upper tooth tip exactly as in
  the approved sheet; that is not changed here. The machine checks pass at 320
  and 1280 (`results.json`). The catalogue contrast gate passes on both screens.
- **Prepare for Halloween (Collection).** The only change is this member's
  design; the items, order, stages, words and dates are unchanged. The other
  four setups keep their current approvals.

# 0133: A fresh setup has nothing to fix

Date: 2026-10-09. Status: accepted.
Amends [0085](0085-goals-have-publish-contracts-and-stable-history.md) (lead
magnet handoff, offer links, result links),
[0088](0088-handoff-state-and-required-fixes-lead-the-review.md) (what list
Goals and lead magnets require),
[0132](0132-every-screen-answers-its-first-question.md) §11 (the local default)
and [0032](0032-consent-capture-is-first-class-in-the-template.md) (which links
take the privacy policy).

A UX review of the campaign editor found that the recommended setup opened
with "3 to fix", that the header's count and the screens' "Issues (n)" button
disagreed, and that several of the fixes were the setup's own doing: an email
form with nowhere to send leads, an offer button with no address, a quiz result
with no link. A merchant who picks a recommended setup and presses Publish
should not meet a list of things the setup itself created.

## Decisions

1. **Leads stay in WConvert until a service is connected (D3).** One reading of
   `capture_mode` on each side — `OptinBinding::captureMode()` and the admin's
   `captureModeOf()`: an explicit `local` or `connected` wins; with none stored,
   a config that binds a Destination anywhere is `connected` and one that binds
   nothing is `local`. Choosing a destination writes `connected`; removing the
   last one writes `local`. Creation no longer writes the mode (the
   `keepLocallyUntilConnected` step of 0132 §11 is gone), and every design that
   saves a lead shows the choice, whatever its Goal. The services stay one
   choice away while local.

   *Why derived rather than "absent means local":* a config written with
   Destinations and no mode — by a script, or a draft from before this — would
   otherwise be cut off from its routes in silence.

2. **Kept local satisfies the Goal (D9).** `handoffIssue()` returns nothing in
   local mode, including for a lead magnet. The review warns, without
   blocking: "Visitors won't get the file until you set up the delivery email."
   Choosing to connect and not finishing still blocks.

3. **Link buttons start somewhere real (D10).** Prefill points every link
   button at the WooCommerce shop page, or the home page, including the Pro
   samples' `/shop/`, `/sale/` and `example.com` addresses. Each is recorded in
   `config.unchecked_links` as `{id: {href, place}}`, and the review lists
   "Check where 'Shop the sale' goes (now: Shop page)" while the button's
   address still equals the recorded one — so editing the link clears it with
   no write. The record is authoring state: `PublishedProjection` ships none of
   it. An address the merchant clears still blocks. Cart recovery is left
   alone; its way back to the cart is the renderer's (ADR 0025).

4. **A result's link is optional (D11).** A result with no address shows no
   button (both renderers already hid it); `ResultSettings` says so. An address
   with no words still blocks, and so does a product result whose products are
   not chosen — no default product is a safe guess.

5. **A phone field's "site default" falls back to the site's region.** With no
   default in Settings, `PhoneCountry::effectiveDefault()` reads the store's
   country, then the region of `get_locale()` (`en_GB` → GB). The admin's
   `phoneDefaultCountry` and the publish check read that one value.

6. **Only consent wording and fine print take the privacy policy.** An empty
   link anywhere else is unfinished, not a request for the policy: it stays
   hrefless, the editor no longer promises the policy there, and both the
   review ("Add a web address for 'x'") and publication (`link`) refuse it.

7. **One issue list feeds every count.** `builder/readiness/campaignIssues.ts`
   returns every blocker and every advisory as data — what to say, whether it
   blocks, which tab, which screen, and where the fix is. The review, the
   header's "n to fix", each screen's warning and each Flow badge read it; the
   separate "Issues (n)" button and its dialog are gone. The review also mirrors
   the server's per-signup rule: an optional signup forwarded nowhere while the
   main one is forwarded blocks.

8. **The review's links go where the fix is.** "Position" and "Reopen button"
   open the look settings, not the design library, and an advisory with no
   block to point at opens the design in place.

## The allowed exceptions

`tests/unit/Playbook/FreshSetupTest.php` sends every bundled setup, Free and
Pro, through prefill and the publish checks with no edits. The only blockers it
allows are the merchant's own product choices: the main product for
*recommend-accessory* and *add-useful-extras*, and the products for each result
of the four product finders.

## Not changed

No table or column. Hidden-screen fall-through, the plain style panel and the
single Edit tab are later phases of the same review.

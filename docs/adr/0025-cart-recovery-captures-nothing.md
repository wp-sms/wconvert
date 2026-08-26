# Cart recovery captures nothing

The v1 Goal **"Bring shoppers back to their cart"** is metered by a **click**. Its
[[Optin]] carries no form, produces no [[Lead]], holds no [[Consent Record]], and
pushes to no [[Destination]]. Its whole product is a message on the page and a link
back to the cart.

That is a strange thing to find in a lead-capture plugin, and it was not chosen so
much as discovered — it follows from decisions already made.

## It was already decided, arithmetically

[ADR 0001](0001-custom-tables-not-custom-post-types.md)'s ticket recorded that
**"two of five v1 Goals convert on a click, so not every Conversion is a Lead."**
Of the five, three are unambiguously submit-metered — *Grow my email list*, *Grow my
SMS list*, *Deliver a lead magnet* — and one is unambiguously click-metered,
*Promote a sale or offer*. For "two of five" to be true, cart recovery is the second.

Overturning it is therefore not a local change: it re-opens the storage ticket and
leaves "two of five" naming a Goal that does not exist.

## The form is not merely unnecessary — it is forbidden

*Enforced at the WRITE as of [#36](https://github.com/navidkashani/wconvert/issues/36),
and not only in the library. [`PlaybookLibrary`](../../src/Playbook/PlaybookLibrary.php)
refuses a [[Playbook]] whose Template offers the wrong act and
[`TemplateLibrary`](../../src/Template/TemplateLibrary.php) refuses the Template
itself — but neither is an enforcement mechanism for an OPTIN, because
`POST /wconvert/v1/optins` takes a whole design in `config` and is scriptable by
anyone holding `manage_options`. Without the check,
`{goal: 'recover_cart', template_id: 'stacked-signup'}` was accepted: a cart Optin
with a form on it. [`OptinController`](../../src/Rest/OptinController.php) now asks
the same question the library asks, on create and on edit, against the Goal the
Optin will HAVE — and refuses a click-metered Optin holding [[Destination]] ids for
the same reason, since it captures nothing to send. That is
[ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)'s "a screen is not an
enforcement mechanism" applied to the other half of the pairing.*

`CONTEXT.md` holds that **every [[Lead]] is a [[Conversion]]; the reverse does not
hold.** A click-metered Optin that also carried a form would emit Leads that are not
Conversions, which inverts that rule rather than bending it. `CONTEXT.md`'s
[[Template]] entry closes the other exit: an Optin with two candidate converting acts
is *rejected at registration*, never disambiguated at runtime.

So the shape is forced in both directions. No form, one step
(see [Consequences](#consequences)), no consent node, no [[Destination]].

**The use case does not disappear; it routes.** A merchant who wants *"enter your
email and we'll save your cart"* is served by **Grow my email list** with a
`cart_has_items` [[Condition]] — the Goal that honestly counts a submission. The
taxonomy already had the right home for it.

*Reachable as of [#36](https://github.com/navidkashani/wconvert/issues/36), which
registers `cart_has_items` as an ordinary premium Condition available to any Goal.
The routing is therefore a merchant's own hand in the rules panel, and deliberately
not a bundled [[Playbook]]: an entry pairing a cart Condition with a non-cart Goal
would suspend the Optin on every store-less install that started from it, which
`tests/unit/Playbook/BundledPlaybooksTest.php` refuses.*

## What this buys against WSMS

WSMS premium ships a complete cart-recovery product —
`premium/modules/woo-commerce/src/AbandonedCart/` — with a consent guard, signed
recovery tokens, a sequence compiler and per-currency recovered-revenue reporting.
[ADR 0024](0024-wconvert-writes-no-wsms-engagements.md) flagged that WConvert must
decide against that rather than in a vacuum.

The overlap turns out to be **zero, and structurally so**. `AbandonedCartCapture::register()`
hooks exactly three places: `woocommerce_checkout_update_order_review` (classic
checkout), `woocommerce_store_api_cart_update_customer_from_request` (block
checkout), and `woocommerce_cart_updated` — and the last only *refreshes* an identity
already established. `CartAbandonedTrigger` states it outright: it fires *"when a cart
with a known email or phone sits idle past the abandonment cutoff."*

**WSMS cannot see a shopper who never reached checkout.** That shopper is exactly
WConvert's visitor. The split is not "on-site display versus messaging after it" — it
is **before checkout versus after identity**, and the two features cannot reach the
same person.

This is why the split is documented and **never detected at runtime**. There is no
double-send to warn about, so probing another plugin's premium module internals to
render a comparison would buy brittle coupling for no safety —
unlike [ADR 0023](0023-the-wsms-push-fires-wsms-contact-events.md)'s
`OutboundSyncManager` double path, which was detected because it was a real hazard.

## The coupling: one cookie, two reads, no writes

*Recorded by [#36](https://github.com/navidkashani/wconvert/issues/36), which had
to build what this ADR only implied.*

*A [[Condition]] is evaluated in the browser at the instant a [[Trigger]] fires, so
the answer has to already be on the device — a rule that had to ask the server
would make the rule engine asynchronous. And it cannot be a WSMS
[[Engagement]]: the browser knows of no visitor identity, so "has an open cart"
cannot be asked of a person, and where WConvert needs cart state it observes the
cart itself.*

*So [`CartCookie`](../../pro/src/WooCommerce/CartCookie.php) writes
`<count>:<total>` on `woocommerce_cart_updated` and Pro's two loader modules read
it. **Two hooks rather than the one #36 asked for**, and the second was found on a
real WordPress rather than by the suite: `WC_Cart::empty_cart()` — what a
COMPLETED CHECKOUT calls — fires `woocommerce_cart_emptied` and never calls
`calculate_totals()`, so `cart_updated` never fires. On one hook, a shopper who
had just paid kept a cookie saying three items were waiting and the Optin told
them so on the order-received page: this ADR's own lying popup, reached by buying
something.* **The scope is capped at two numbers and never contents** — no product ids, no
SKUs, no names — which is what makes cart-*contents* Conditions a later, additive
decision rather than one the cookie settled by accident. The count is there because
the count is what the copy asserts: a rule named `cart_has_items` answered from the
total alone reports "empty" about a fully-discounted cart that has three things in
it.*

*It lives in **Pro**, because both Conditions are `tier: pro` and free's loader has
no module for either — a free install writing to every shopper's device for nothing
is what "nothing is written before its subject" forbids
([ADR 0029](0029-the-free-contract-is-proven-at-the-source.md)).*

***`functional`, booked as a judgement call rather than an obvious reading.*** *The
case for: it records something the visitor did on this site, in this session, to
operate a feature of it; it is not read across sites and names nothing about who
they are. The case against is real — cart recovery is marketing in intent — and it
loses on consequence: `marketing` is withheld by default under every consent plugin
worth having, so the purist reading **silently kills the Goal across the EU**. The
merchant would buy Pro, build the Optin, and watch it never show, with nothing in
any log.*

## No coupon minting, and not as a preference

WSMS's module mints a coupon per recovery. WConvert does not, and cannot: the
front-end payload is baked into HTML the full-page cache serves **byte-identically to
every visitor** ([ADR 0003](0003-published-set-projection-no-second-cache.md),
[ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md)). A per-visitor
code is impossible in this delivery model, not merely unwise — only a static shared
code can ever appear, and a static code the merchant already created in WooCommerce
is just words they type into the copy.

Minting would also be a **write into WooCommerce's data** (a `shop_coupon` post),
which is [ADR 0024](0024-wconvert-writes-no-wsms-engagements.md)'s error in a
different table.

*Asserted rather than argued as of [#36](https://github.com/navidkashani/wconvert/issues/36):
`tests/unit/Pro/WooCommerce/NoWriteIntoWooCommerceTest.php` reads both plugin trees
and fails on a coupon, an order, a cart mutation or a write into WooCommerce's
session — the same posture, and the same tokenised scan, that ADR 0024's own test
takes over `wsms_engagements`. The failure either exists to catch is a line
somebody ADDS, which no assertion about output can see.*

## Consequences

- **Cart-recovery templates have one step, not two.** *Enforced by
  [#27](https://github.com/navidkashani/wconvert/issues/27) at registration
  rather than left to the author:
  [`TemplateLibrary`](../../src/Template/TemplateLibrary.php) rejects an entry
  whose step count disagrees with the converting act its tree offers, so a
  click-metered design carrying a success state is refused where it is written.
  The click Goal's Playbook rides the same one-step Template as the other click
  Goal's, which is this bullet's "property of the metric, not of WooCommerce"
  made concrete.* The [[Template]] ticket's
  *"every v1 template already has two — the success state is a terminal step"* is true
  only of **submit-metered** templates. A click navigates the visitor away, so there is
  no success state left to render, and an interstitial is worse than the navigation it
  delays. This applies equally to *Promote a sale or offer*; it is a property of
  click-metered Goals, not of WooCommerce.
- **No new [[Slot Role]].** The discount code is body copy the merchant edits.
  *Held by [#36](https://github.com/navidkashani/wconvert/issues/36): the three
  cart [[Playbook]]s fill `headline`, `body`, `cta_label` and `fine_print` and
  nothing else, which is the same four the sale Playbook fills.*
- **The CTA's target is renderer-resolved**, from `wc_get_cart_url()`, with a
  settings-panel override — the same shape as the privacy-policy link in
  [ADR 0032](0032-consent-capture-is-first-class-in-the-template.md), and for the
  same reason: a [[Playbook]] can express nothing site-local.
  *Built as [`CartLink`](../../src/Template/CartLink.php) in
  [#36](https://github.com/navidkashani/wconvert/issues/36), beside `PolicyLink`
  and resolved at the same moment in
  [`LoaderEnqueue`](../../src/Frontend/LoaderEnqueue.php) — never frozen into the
  published set, so moving the cart page corrects every running Optin without
  republishing one.*

  ***And it is keyed on the [[Goal]], which the policy link did not have to be.***
  *PolicyLink's rule is purely structural — a link declaring a label and naming no
  destination is asking for the one destination only the site can name — and that
  works because a WordPress site has exactly ONE privacy policy. A CTA has no such
  uniqueness: this ADR's own "property of the metric, not of WooCommerce" means*
  Promote a sale or offer *ships the identical href-less click CTA, and its
  destination is the merchant's. A structural rule would have pointed every
  unconfigured sale Optin at the cart. So the Goal rides the published projection
  beside the payload — PHP reads it to resolve the link and the browser never sees
  it, which costs the page nothing.*

  ***The override is the absence of a special case.*** *A `button` declares `href`
  as content, so the settings panel already draws a control for it; a merchant who
  typed one has named a destination and it wins. A cleared control is an absent
  key, so clearing restores the site's own — emptiness judged the way a form field
  is, which is the reading the rule vocabulary already takes one axis over.*
- **No WooCommerce-specific templates.** What the Goal needs is *one step,
  click-metered, CTA-bearing* — a shape shared with the other click Goal, not a
  WooCommerce design.
  *Held literally by [#36](https://github.com/navidkashani/wconvert/issues/36):
  all three cart Playbooks name `offer-panel`, the design the sale Playbook
  already used, and the Template library gained nothing. **So the three differ on
  one axis and it is INTRUSION** — exit intent, then fifteen seconds, then page
  load. That is the only axis worth three cards once the design is shared, and it
  is the axis a merchant can actually reason about: how loudly to ask.*

  ***They name [[Pro]]'s own Triggers, and that is safe only here.*** *Two of the
  three prefill `exit_intent` and a premium Condition, which no other bundled
  entry may do. It holds because this Goal is `tier: pro` and needs WooCommerce,
  so Pro is present by definition wherever the gallery is reachable
  ([ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)) — the rule that
  replaced "no bundled entry names a premium rule" is that a Playbook may name
  what its Goal already guarantees, and nothing more.*
- **Order attribution stays out of v1.** WSMS's own screen already reports per-currency
  recovered revenue off `converted_at`, correctly, in the plugin that owns the order
  lifecycle. A second, weaker number derived from a click marker would give a merchant
  running both **two figures that disagree**.

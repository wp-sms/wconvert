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

## Consequences

- **Cart-recovery templates have one step, not two.** The [[Template]] ticket's
  *"every v1 template already has two — the success state is a terminal step"* is true
  only of **submit-metered** templates. A click navigates the visitor away, so there is
  no success state left to render, and an interstitial is worse than the navigation it
  delays. This applies equally to *Promote a sale or offer*; it is a property of
  click-metered Goals, not of WooCommerce.
- **No new [[Slot Role]].** The discount code is body copy the merchant edits.
- **The CTA's target is renderer-resolved**, from `wc_get_cart_url()`, with a
  settings-panel override — the same shape as the privacy-policy link in
  [ADR 0032](0032-consent-capture-is-first-class-in-the-template.md), and for the
  same reason: a [[Playbook]] can express nothing site-local.
- **No WooCommerce-specific templates.** What the Goal needs is *one step,
  click-metered, CTA-bearing* — a shape shared with the other click Goal, not a
  WooCommerce design.
- **Order attribution stays out of v1.** WSMS's own screen already reports per-currency
  recovered revenue off `converted_at`, correctly, in the plugin that owns the order
  lifecycle. A second, weaker number derived from a click marker would give a merchant
  running both **two figures that disagree**.

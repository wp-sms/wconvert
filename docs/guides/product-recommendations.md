# Set up product recommendations

Recommend a few useful extras for a main product. Choose product-page links or let shoppers add simple products directly.
WConvert Pro and WooCommerce must be active.

## Choose products

1. Open a campaign with a **Product recommendations** element. The
   **Recommend a compatible accessory** starting point includes one.
2. Open **Theme & layout**, then **Layers → Product recommendations**.
3. Choose the **Main product**.
4. Under **Recommended extras**, choose products yourself or select
   **WooCommerce cross-sells** to use pairings saved on the main product.
5. Keep **Hide items already in the basket** checked unless you want to show
   those items again.

Choose up to six extras and use the arrows to set their order. The first three
available extras appear. The main product is never recommended to itself.
Sold-out, hidden, private and unpurchasable products are skipped. If nothing
useful remains, the offer stays hidden.

Cross-sells are pairings you save in WooCommerce under the main product's
**Product data → Linked products → Cross-sells**. WConvert does not decide
whether two products are compatible. Pick extras you know work together.

## Choose when and where

- **Viewing the main product:** show extras on that product's page, even with
  an empty basket.
- **Main product is in the basket:** require the main product in the basket.
  Recommendations can appear on the pages allowed by your display rules.

Select **Placement & rules** to review pages, audience, opening conditions and
repeat limits. Choosing a shopping condition does not install a placement or
override those rules.

For an inline campaign on a classic WooCommerce theme, use the supported
placement after the product summary. On a block theme, add the existing
WConvert campaign block to the appropriate product template in the Site Editor
and select your campaign. Custom builders may need manual placement.

## Test before publishing

In **Display rules**, select **Test a sample visit**.

1. For product-page recommendations, choose the **Viewed product**. Leave the
   sample basket empty. You should see the eligible extras.
2. Add one extra to the sample basket. It should disappear from the suggestions.
3. Add every extra. There should be no eligible suggestions.
4. For basket-based recommendations, test both with and without the main product.
5. Check the other conditions. These are assumptions you control, not automatic
   checks of your actual page, schedule or placement.

Sample visits use your current draft and live catalog availability. They do not
change a real basket or record clicks or sales. Enter sample amounts yourself
when testing amount rules; product prices do not calculate those fields.

Select **Review & publish** when ready, then visit the actual product page on
desktop and a phone. Use the real WooCommerce cart to check exclusion and links.

## If nothing appears

Check the chosen main product, shopping condition, available extras, placement
and display rules. For cross-sells, check that pairings are saved in WooCommerce.
An unavailable basket or missing required functional consent also prevents
recommendations. Use **Test a sample visit**, or the storefront's **Why no popup?**
tool while signed in as an administrator, to investigate.

## Read results correctly

**View product** opens the selected product page. Variable products use
**Choose options**. A product click is not an addition or a purchase. Preview and
diagnostic activity must not be interpreted as shopper results.

To stop the offer, unpublish the campaign. This does not remove items from
anyone's WooCommerce basket.

## Let shoppers add extras directly

Create a campaign with **Increase basket value → Add useful extras**. Choose the
main product and extras, then keep **Product action → Add to cart** selected.
This starting point requires the Elite commerce capability (shown as WConvert Pro).
An existing published click campaign keeps its original goal; create a new campaign
for addition results.

A button adds one item. Products needing options open their product page instead.
Extensions that add custom cart fields or validation can make direct additions
unavailable; use **Open product page** with the offer goal for those stores.
If prices change or WooCommerce refuses the item, shoppers can open its product
page. A lost response says to check the basket; WConvert does not retry it.

**Basket additions** counts campaign appearances with at least one confirmed
addition. **Items added to basket** counts all successful additions. Adding two
extras in one appearance is one headline result and two items. Neither is a
purchase. Reports and CSV keep these results separate from product clicks.

Successful cards stay visible until the appearance ends so the confirmation and
keyboard focus remain available. New appearances exclude basket items as usual.
The real WooCommerce cart remains the place to review quantities and totals.

Reports show completed days. Today's test additions appear in the standard report
window tomorrow.

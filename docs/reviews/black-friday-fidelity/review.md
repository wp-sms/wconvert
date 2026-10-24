# Native fidelity review — 24 October 2026

This is the earlier renderer review. The later [actual WordPress review](../black-friday-wordpress/review.md) and [verification record](../black-friday-wordpress/validation.md) supersede its completion claims and contain the current fonts, responsive fixes and plugin captures.

The initial implementation passed structural and interaction checks but lost visual fidelity. Generic root padding, display fonts and timer defaults changed the approved compositions. This review compares all fifty designs against the unchanged approved prototype at desktop and phone widths, then checks prepared campaigns and acknowledgement screens using the shipping renderer.

This is an editor-compatible reconstruction, not a pixel-identical HTML import. Native text, fields, actions, coupons, countdowns and product images remain editable. The original artwork is retained or reconstructed from the original vector sources; no competitor images are imported. Arrows stay SVG and decoration does not rotate. Small photo captions, borders, masks and decorative layers have the specific adaptations below. Form inputs use 16px text and readable fine print; merchant consent follows site settings. Countdown values in comparisons are illustrative, while WordPress uses a real configured deadline.

`after-sheet-1.html` through `after-sheet-10.html` pair every approved reference with the native result. The `campaign-…-320.png` and `campaign-…-1440.png` cards include every prepared screen. `results.json` records the real WordPress journeys. Mechanical counts and limitations are in `validation.md`.

- **01 · Welcome Buddy (General):** Matched lavender/mint palette, bold display face, mascot crop and rounded action; image stacks above the offer.
- **02 · Welcome Perk (General):** Restored peach dispenser composition and coloured second headline. The action refers to the discount rather than hard-coding a merchant-editable coupon.
- **03 · Friday Coupon (Black Friday):** Restored mint ticket and deep-green ink; side cutouts reveal the actual red surface. Code and offer remain editable.
- **04 · Turn It Up (Black Friday):** Restored blue product photograph and lime equalizer. The image and copy use separate native panes instead of prototype absolute layering.
- **05 · Friday Comic (Black Friday):** Restored the original face drawing, mint/pink comic panels and bold offer. The speech callout uses a native badge.
- **06 · Price Elevator (Black Friday):** Restored red price panel and purple/red heading. Explicit “WAS $100” replaces decorative strikethrough; the example remains clearly labelled.
- **07 · Private Preview (Black Friday):** Restored the glowing doorway and italic serif reward. Entry request, form and acknowledgement remain native; decorative VIP lettering is omitted.
- **08 · Outdoor Edit (General):** Matched landscape, forest palette and orange reward. Outdoor wording stays general; the small image badge is omitted.
- **09 · Savings Receipt (General):** Kept receipt reading order, savings total and barcode. Bounded native eyes and straight paper edges replace custom prototype shapes.
- **10 · Welcome Shortcut (General):** Restored concentric peach/purple arch and coupon placement. Native code border and fewer arch rings are deliberate editor adaptations.
- **11 · Sneaker Edit (Black Friday):** Matched trainer crop, charcoal ground and lime reward. The phone keeps product-first reading order.
- **12 · Midnight Fragrance Edit (Black Friday):** Restored serif/italic headline, arched fragrance photograph and separate offer footer; editable native copy replaces decorative photo labels.
- **13 · Wishlist Alert (Black Friday):** Restored chat context, pink palette and serif preview request. Messages use native panels; the form and honest request acknowledgement follow them.
- **14 · Garden Edit (General):** Restored the original three-flower artwork and lime/forest palette. Phone order places copy before the flowers.
- **15 · Friday Pass (Black Friday):** Restored passport green, globe artwork and italic offer. Native framed offer panel replaces the prototype thin oval stamp.
- **16 · Delivery Buddy (General):** Restored dark-space product image and mint reward. The native split replaces full-bleed image layering.
- **17 · Black Friday Archive (Black Friday):** Restored archive strip and large 60% label; corrected repeated “up to” wording. Corrugation is simplified to a flat cardboard colour.
- **18 · Extra Gift (General):** Restored product-first gift layout and purple/yellow palette; eligible spend and availability remain explicit.
- **19 · Friday Game Code (Black Friday):** Restored mint headline/pixel versus orange reward inside the dark game screen. Coupon and shopping action remain separate.
- **20 · Fragrance Booth (Black Friday):** Restored three different close crops from the fragrance photograph; the strip becomes a compact horizontal group on phones.
- **21 · Sweet Edit (General):** Corrected the pink offer circle and condensed type. The ordinary shopping action remains on one line; wrapper decoration is simplified.
- **22 · Black Friday Fast Lane (Black Friday):** Restored compact white three-unit clock on blue, with the orange shopping action. Timer still uses the configured real deadline.
- **23 · Packing Perk (General):** Restored the six-bubble illustration and compact split bar. Art and text stay beside each other before the phone action.
- **24 · Friday Email Alert (Black Friday):** Restored the yellow/plum preview bar. A shorter “Get access” label and wider action allocation keep the ordinary CTA on one line.
- **25 · Your Welcome Pal (General):** Restored arched mascot image and lavender slide-in. The outer card keeps a modest radius so it cannot clip the close control.
- **26 · Breakfast Edit (General):** Restored the toaster photo, sky-blue background and orange action; the specific kitchen offer stays general.
- **27 · Welcome Label (General):** Restored pale-green rounded coupon label and purple copy; code wording follows the configurable coupon.
- **28 · Pixel Play Sale (General):** Restored four original pixel characters and blue gaming palette. All four remain visible on phones instead of hiding one.
- **29 · Black Friday Departments (Black Friday):** Restored three product departments and green offer typography. Phone layout retains all departments instead of dropping the last image.
- **30 · Anniversary Event (General):** Restored the original smiling balloons as a decorative background with native centred anniversary copy and action.
- **31 · Streetwear Poster (Black Friday):** Restored the black/lime streetwear poster, oversized condensed masthead and product/offer split; the image retains a useful phone crop.
- **32 · Tech Price Sheet (Black Friday):** Restored close-up tech photograph, sample old/new price and separate purple markdown panel. “WAS” remains explicit editable text.
- **33 · Fifty-Fifty Poster (Black Friday):** Restored black/lime oversized percentage hierarchy and Black Friday ribbon. Number and percent sign are separate editable text blocks.
- **34 · Black Friday Coffee Menu (Black Friday):** Restored dark coffee menu, warm image and inline discount. Terms use readable native text.
- **35 · First-Access Pass (Black Friday):** Restored the lime date stub and black form. Explicit compact stacking removes blank bands; the date becomes a small phone grid.
- **36 · Restock Mosaic (Black Friday):** Restored three product close-ups and periwinkle reward. Native background crops keep the three windows compact on phones.
- **37 · Golden Weekend Ticket (Black Friday):** Restored dark/gold ticket and dark shopping action. Native side cutouts and code border replace the prototype perforated seam.
- **38 · Finish-Line Countdown (Black Friday):** Restored vertical three-unit countdown rail on desktop and horizontal units on phones; date precision does not alter expiry behaviour.
- **39 · Sound Circle (Black Friday):** Restored circular headphones photograph, blue reward and three-part desktop layout. Phone offer remains with the image column.
- **40 · Layer Edit (Black Friday):** Restored compact apparel/photo split and lime footer action. Additional close clearance and readable offer text are intentional.
- **41 · Black Friday Plus One (Black Friday):** Restored product close-up, large plus sign and salmon action; gift threshold and one-per-order terms remain explicit.
- **42 · Savings Staircase (Black Friday):** Restored three ascending savings cards with individual product crops and rewards. Phone cards flatten into readable product/offer rows.
- **43 · Twelve-Month Deal (Black Friday):** Restored the twelve-month grid, lavender emphasis and annual-price row; renewal terms remain visible.
- **44 · Drop Alert (Black Friday):** Restored oversized 40% lead, black/lime palette and preview form. Consent visibility follows site settings.
- **45 · Deadline Scoreboard (Black Friday):** Restored orange header, bold DM Sans offer and open three-unit clock. Removed the blank top strip and boxed four-unit layout.
- **46 · First-Dibs Signup (Black Friday):** Restored lime date stub, compact headline and intentionally vertical form. Phone stacking keeps the date, offer and form together.
- **47 · Free-Delivery Label (Black Friday):** Restored pale shipping label, barcode and periwinkle zero-delivery offer. Corrected padding and bounded barcode width prevent overflow.
- **48 · Extra-Ten Coupon (Black Friday):** Restored shoe photo and salmon divider above the extra-ten offer. The code action avoids repeating the editable coupon value.
- **49 · Home Edit (Black Friday):** Restored three-column home layout, warm chair photograph and independent offer panel. Shortened the button to “Shop home”.
- **50 · Black Friday Department (Black Friday):** Restored condensed black/lime masthead, three product windows and closing reward/action row. Native emphasis wraps at phrase boundaries.

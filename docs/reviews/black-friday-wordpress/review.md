# Black Friday and everyday templates — actual WordPress review

Reviewed the fifty approved concepts against the original prototype using the shipping plugin on disposable WordPress, at 1440px desktop and 390px phone widths. The reference prototype was not changed. The collection retains 35 explicitly Black Friday and 15 general campaigns.

## What was fixed

- Local licensed fonts replace accidental Impact/system fallbacks; external Google Fonts permission is unchanged.
- Explicit native column ratios, phone stacking, image sizing, control alignment and readable field palettes replace generic approximations.
- Exactly three reusable editor controls were approved: text weight, solid/dashed dividers and plain/boxed coupon appearance. They use existing styling sections. Receipt edges and oval eyes use ordinary image artwork.
- The oversized coupon display has a distinct offer_amount role. Ordinary sentence headlines cannot transfer into it, and generic new headings do not silently become numeric offer blocks. A missing amount is called out instead of inventing an offer.
- Coupon copy now remains coherent when adding email capture moves the code to acknowledgement. Actual coupon values and deadlines still require merchant configuration.

## What the copy investigation establishes

Transferring Closing time copy into the former generic headline of Extra-Ten reproduced the oversized sentence shown in the report. Direct fresh setup, Closing time preview followed by Extra-Ten, and an out-of-order response check all preserved the chosen setup's own copy. The role collision is fixed; the original fresh-setup interaction itself was not reproduced, so its initiating cause remains uncertain. See setup-copy-investigation.json.

## Review boundary and practical differences

The screenshot files named *-wordpress.png come from the real WordPress shipping loader, with no injected fonts or replacement renderer. Separate *-viewport.png files preserve the initial viewport; complete-content screenshots expand only the scrolling surface after the initial capture. Functional checks use separate disposable fixtures.

The result is a native, editable adaptation, not pixel identity. Form labels, consent, touch targets and secondary text retain usable sizes. Some phone compositions stack rather than reproduce bespoke prototype rearrangements. Decorative artwork can be replaced as an image; its individual shapes are not editor controls. Adding a form can make a design taller, notably Home Edit's desktop image pane. Close-button positioning follows each native display format.

Visual fixtures explicitly configure fictional sample coupons for comparison. These are not claims that the coupons exist in a store. Countdown values depend on the fixture deadline and therefore differ from the frozen prototype.

The unrelated-library comparison used the same bundled fonts in both renderer versions: 952 paired screenshots, 270 unchanged setup decisions (229 approved, 41 revise), no visual differences. The prior decisions were preserved; those 41 were not promoted to approvals. This establishes renderer layout stability under intended fonts, not historical font delivery equivalence.

## Individual visual findings

- **01 · Welcome Buddy** — Same artwork, purple/green palette, condensed headline and pill action at both widths. Phone copy takes slightly more vertical space; the image crop and native close size differ.

- **02 · Welcome Perk** — Vending picture, first-order headline and actual WELCOME10 code remain coherent. Body now says the offer without promising a visible code before email capture; native coupon box is a functional control rather than the prototype's decorative text strip.

- **03 · Friday Coupon** — Red/mint coupon, matching notch colour and 40% display retained. Public code is populated; body now works before and after email capture. Native coupon styling and extra copy wrapping change spacing; form palette corrected for readable text. Palette references were rechecked against pre-refactor actual WordPress captures: normal and email desktop/phone views are pixel-identical.

- **04 · Turn It Up** — Full-width headphone image restored on phone; headline and CTA are readable and arrows intact. Desktop uses separate native copy/art panels; the outlined ghost word behind the prototype was not reproduced.

- **05 · Friday Comic** — Two framed panes, original smiley, live speech bubble and bold headline restored; inherited min-height no longer creates a giant blank bubble. Phone keeps the two panes side by side instead of the prototype's stacked panels. Texture, border weight and bubble placement differ.

- **06 · Price Elevator** — Red framed price card and original/current price hierarchy retained. Uses editable “WAS $100” instead of strike-through; card stays vertically arranged on phone instead of switching its price row orientation. Form field now uses the light base palette for contrast. Palette references were rechecked in actual WordPress: normal desktop/phone and desktop email are pixel-identical; phone email adds 8px between the field and action, keeping both readable. Final decorative-dot whitespace cleanup was rechecked in all four actual WordPress views; all are pixel-identical.

- **07 · Private Preview** — Matching Times serif and italic emphasis restored; door art, live VIP lettering, email and consent remain editable. The door is smaller with a separate date caption, and the email/control spacing is larger than the prototype. Final contrast review: a small dark native pill now sits behind the editable VIP letters, so the gold letters remain readable over the bright doorway. Actual desktop/phone views were checked against the prototype; the pill is an intentional addition.

- **08 · Outdoor Edit** — Tent artwork, condensed offer and earthy colours retained, with clean mobile order. Live “MORE OUTSIDE” badge sits below the art rather than floating over it; crop and spacing differ.

- **09 · Savings Receipt** — Final actual desktop and phone retain friendly eyes, dashed receipt rules, monospace ledger, compact action and serrated bottom using ordinary image artwork. The original visual is closely retained; spacing and close size differ.

- **10 · Welcome Shortcut** — Arch artwork and real WELCOME15 code retained. Body no longer promises a code below before capture; native coupon control is larger than the prototype text. Form input contrast corrected without recolouring the arch. Palette references were rechecked against pre-refactor actual WordPress captures: normal and email desktop/phone views are pixel-identical.

- **11 · Sneaker Edit** — Product photo, bold type, lime action and dark palette retained. Caption is a live full-width band below the photo instead of a small overlapping tag; caption and email field contrast corrected. Palette references were rechecked against pre-refactor actual WordPress captures: normal and email desktop/phone views are pixel-identical.

- **12 · Midnight Fragrance Edit** — Times serif/italic, framed arch photo, divider and offer footer restored. Photo crop differs; the small picture caption is absent and the percentage/footer typography is native editable text rather than individually positioned glyphs.

- **13 · Wishlist Alert** — Chat bubbles alternate, original face artwork appears in the header, matching serif/italic restored and form remains usable. Face colour/size, bubble radii, field fill and vertical spacing differ from the prototype. Final contrast review: the lavender reply bubble now uses the darker body foreground. Actual desktop/phone views retain the same composition and were checked against the prototype.

- **14 · Garden Edit** — Floral artwork, green palette and large headline retained on desktop and phone. Artwork shows the full flowers rather than cropping them at the bottom; native phone layout has more breathing room.

- **15 · Friday Pass** — Double-frame passport, globe, oval offer and barcode restored with matching serif copy. Phone passport stays vertically composed rather than the prototype's compact internal rearrangement; readable form/consent increases total height.

- **16 · Delivery Buddy** — Source image now occupies a bindable picture slot, with the gradient on a separate native surface. This fixes both the 74 KB embedded-data budget failure and lost artwork. Final actual normal and email desktop/phone captures verified: picture is visible, gradient covers the full surface and copy stays over the dark ground. Normal phone is 620px tall; email variant grows to 764px for functional fields/consent. Crop and robot scale differ slightly from the approved prototype. Final palette-reference refactor was reviewed again in actual WordPress: normal and email desktop/phone views are pixel-identical to the prior approved implementation, including the phone gradient fade.

- **17 · Black Friday Archive** — Archive texture, blue event strip, condensed headline, offer card and barcode retained. The phone coupon stays vertical rather than rearranging its contents into the prototype's horizontal label. The form remains grouped with the offer copy and readable.

- **18 · Extra Gift** — Product photo fills its native media column and the gift caption stays below it. Phone stacks the photograph above the offer. Adding a form increases height; the caption remains at the bottom of the image pane.

- **19 · Friday Game Code** — Framed arcade panel, heavy offer and public coupon preserved. Native pixel decoration differs from the prototype illustration. Root and input colors were separated from the art palette; actual phone field and fine print are readable, including the email variant. Final palette-reference refactor was reviewed again in actual WordPress: dark-green screen, pale artwork/text, coupon and cream form fields remain readable on desktop and phone. The approved outer 1px border removal changes edge pixels; native nesting retains the composition.

- **20 · Fragrance Booth** — Three cropped perfume images, caption and offer retained. Native live caption uses more space; phone shows the image strip above the offer. Form remains readable without detached actions.

- **21 · Sweet Edit** — Pink percentage badge stays beside the headline on phone, with a fluid font size preventing the percentage from breaking over two lines. Native close placement differs from the prototype; email capture expands the bar vertically.

- **22 · Black Friday Fast Lane** — Checker rail, condensed headline, real countdown and action retained. Decorative checks scale with the panel height. The action is in its own native group so adding a form keeps field, submit and consent together; native close placement and timer values differ.

- **23 · Packing Perk** — Original bubble artwork remains next to the offer, followed by a pill action. Phone and desktop hierarchy is retained. The added form sits below on phone; native close control follows the floating-bar placement.

- **24 · Friday Email Alert** — Fixed outer phone stacking and adjacent desktop input/button baseline. The shorter Get access label remains on one line. Native consent follows the submit control; required labels and readable terms add a little height.

- **25 · Your Welcome Pal** — Original monster image keeps an arch inside a rounded native card, leaving a safe visible close button. The outer silhouette is rounded rather than fully arched. Offer, form and action remain readable.

- **26 · Breakfast Edit** — Kitchen image, condensed offer and orange action retain the prototype hierarchy. Native supporting text is larger and adds height; converted email controls retain readable contrast.

- **27 · Welcome Label** — Plain selectable code, rounded offer panel and right-hand copy retained. Phone stacks these sections. Body copy now makes sense both with a public code and when signup reveals it on acknowledgement.

- **28 · Pixel Play Sale** — Pixel characters, large headline and offer remain distinct. Phone retains all four characters rather than clipping one. The action has a native group so the optional email form stays together; larger text and terms add height.

- **29 · Black Friday Departments** — Boxed popup replaces the incorrect fullscreen default. Product images and bold offer are retained; phone shows all three products rather than clipping the third. Converted input now uses a light background with readable dark text.

- **30 · Anniversary Event** — Boxed popup, balloon artwork and centered offer/action retained. Balloon artwork scales smaller on phone than the prototype. Optional email capture adds height while retaining a single-line action and readable consent.

- **31 · Streetwear Poster** — Bold type, fashion image, lime offer and full-width action retain the reference hierarchy at both widths. Native supporting copy and the consolidated date eyebrow add height. The converted email form is readable but flush to the card edges where the original action was full bleed.

- **32 · Tech Price Sheet** — Keyboard crop, split price panel and lavender discount strip retain the reference. The previous price is labelled WAS rather than struck through; native terms are longer. Form fields have readable contrast.

- **33 · Fifty-Fifty Poster** — Large 50/OFF composition and desktop copy/action columns retained. Phone intentionally stacks copy and action. Native fine print remains larger than the prototype's small text.

- **34 · Black Friday Coffee Menu** — Bebas headline, coffee image frame and warm offer/action restored. Product crop differs slightly; native exclusions add a line. Converted form contrast is sound.

- **35 · First-Access Pass** — Date rail on desktop becomes a compact date band on phone. Original signup remains practical; native consent and field labels are readable.

- **36 · Restock Mosaic** — Three product crops, restock headline and heavy offer retained. On phone the native offer becomes its own row; the longer eyebrow and readable body add height. Form contrast is sound.

- **37 · Golden Weekend Ticket** — Gold ticket fills its column, with plain selectable coupon and a wide barcode. Phone stacks the ticket below the offer. The signup variant defers the code until acknowledgement; checkout instructions remain coherent.

- **38 · Finish-Line Countdown** — Sportswear image and timer rail retain the reference; the rail moves below content on phone. Actual countdown values follow the configured deadline. Form remains readable.

- **39 · Sound Circle** — Native nesting moves the offer below headline/photo on phone. The corrected heading/photo ratio keeps TURN intact on desktop. Fresh actual WordPress desktop/phone announcement and form captures were viewed; no clipping, misplaced offer or unreadable form controls remain.

- **40 · Layer Edit** — Fashion photo fills its column, green action retains the full-width design and heading fits phone. Converted form is readable but flush to the bottom edges; no new conversion/editor feature was added.

- **41 · Black Friday Plus One** — Gift frame, plus figure and threshold retained. Mobile crop shows more of the neighbouring bottle than the prototype. Explicit $75+ terms clarify eligibility; form contrast is sound.

- **42 · Savings Staircase** — Ascending desktop tiers and stacked phone rows remain distinct. Discount figures are bold and readable; explicit eligibility terms replace terse prototype microcopy.

- **43 · Twelve-Month Deal** — Real inline width 390px exposed the existing 24rem narrow-token threshold. Authored fluid typography and a font-relative grid basis now provide four columns/two headline lines on phone and six columns on desktop. Updated actual normal and form images viewed, without overflow. Renewal terms remain visible.

- **44 · Drop Alert** — Lime figure and large headline retained. Native form adds preview/eligibility terms absent from the prototype. Correct template identity verified; consent/input contrast is readable.

- **45 · Deadline Scoreboard** — Orange offer band and dark deadline/action area retained. Countdown uses the configured deadline and the close control follows native floating-bar placement. Converted form expands the bar vertically but remains readable on phone.

- **46 · First-Dibs Signup** — Date band and form remain readable. Consent/fine print make the bar taller than the prototype, and the date band fills the available height. Close control follows native floating-bar placement.

- **47 · Free-Delivery Label** — Postal artwork preserved while the root input background was corrected from cream to dark. Updated actual phone form viewed with readable placeholder/input text. Offer, threshold and action fit both widths. Palette references were rechecked against pre-refactor actual WordPress captures: normal and email desktop/phone views are pixel-identical.

- **48 · Extra-Ten Coupon** — Shoe coupon retains numeric 10% rather than sentence copy. Plain code and a full-width dashed separator match the reference; invented notches removed. Fine print now uses neutral checkout wording valid before/after signup. Fresh actual WordPress desktop/phone announcement and form captures were viewed: numeric offer stays intact, and the form defers the code until acknowledgement.

- **49 · Home Edit** — Fluid image/heading values fix the 390px inline failure: the updated normal image is 200px high and heading 52px. Actual normal/form views checked. The desktop converted form adds height below the fixed photo, leaving visible dark space; this remains an adaptation, not pixel identity. Terms and form are readable.

- **50 · Black Friday Department** — Boxed popup default matches the approved composition instead of filling the viewport. Bebas heading, department photos and heavy figure restored. Phone coloured headings use separate native leaves and wrap on word boundaries; converted form remains readable.

## Functional verification

All100 normal journeys passed at320px and1280px. The first pass had one visibility timeout for Deadline Scoreboard at320px; an isolated repeat passed at both widths without a source change. The original attempt and repeat are retained. Its initial timeout cause is unconfirmed.

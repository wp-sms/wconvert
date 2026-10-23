# Practical design review — 23 October 2026

Scope: all 40 Christmas & New Year concepts, including every signup acknowledgement. This is a second review of the prototype, against the current template manifest, image renderer, native layout vocabulary and design guidelines. It is **not native-template approval**: no JSON registration, WordPress runtime, real capture/reward delivery, server catalogue or installed editor was exercised.

## Verdict

Keep the 40-concept batch, with 30 Pro and 10 individually downloadable Free designs. They cover useful seasonal jobs and several reusable layout families. They are not 40 unrelated layout inventions: letters, image splits and compact signup cards have intentional siblings. Preserve those family relationships in catalogue metadata rather than presenting palette variations as new capabilities.

The prototype is a stronger starting point after the changes below. Native authoring must still prove content transfer, form conversion, real expiry, held rewards, theme application and image replacement in WordPress. No new editor capability is required by the proposed composition vocabulary; exact proportions must follow the native renderer, not be copied from arbitrary prototype CSS.

## Findings and changes

1. **Visitor value was too indirect.** Several headings were attractive but hid the actual incentive in body copy; CTA labels such as “Let me into winter” were vague. Signup headings now identify the reward or requested content, and buttons state the action. Decorative voice remains in imagery, palettes and secondary wording.
2. **Every signup depended on a discount.** Design 14 now offers monthly gift ideas without a coupon. Its acknowledgement confirms the request and makes no provider-subscription or delivery claim. The other 14 signup examples retain their visible reward. Code copy is a utility, not a second conversion action.
3. **Some urgency lacked context.** Design 10 now names its real example closing date. All 16 countdown labels identify the relevant offer, signup or ordering window. Design 22 replaces the oversized “11th hour” with editable digital-gift-card wording; it does not suggest only one hour remains. Merchants must configure true dates and valid offers before publishing.
4. **Fine print and controls were too small.** Consent, secondary copy and field labels are 14px; inputs remain 16px. Wrapped consent checkboxes align with the first line while retaining a 44px clickable label. Close, copy, back and primary actions have a 44px target floor. Field boundaries now meet 3:1 contrast; checked solid-background text meets the relevant 4.5:1/3:1 thresholds. Text no longer relies on faded placeholder opacity.
5. **Normal previews hid content resilience defects.** Longer copy, fallback fonts and RTL revealed heading overflow and close-control collisions. Headings and layout children now wrap without widening the campaign, and the close control uses the logical end edge with reserved text space. The dispatch date is a number beside a wrapping label group on phones, not three cramped columns.
6. **Some arrangements implied unsupported editor controls.** Design 10 now uses a two-pane split and keeps the artwork in mobile reading order. Small image marks use the native 72px circular image footprint. Wide banner exports have useful source aspect ratios, so an ordinary image leaf can reproduce them without a custom image-height or crop-offset control. These are ordinary PNG assets; internal illustration parts are not editable shapes.
7. **Non-modal formats looked modal in the review scene.** Slide-ins and bars now leave the demo page undimmed. Their actual triggering, placement and frequency still belong to campaign configuration.

## Review lenses

- **Visitor:** concrete benefit, one action, understandable button, truthful deadline, readable consent and honest acknowledgement.
- **Merchant:** a clear job and placement; no prerequisite for custom HTML, SVG editing, animation code or a working Advent game.
- **Editor:** panels, splits, rows/grids, image leaves, editable text, fields, code, countdown and the existing sparkle decorations. Images and complete image panels are different things: removing a whole pane may require adjusting the layout; replacing a picture does not recolour its surrounding panel automatically.
- **Device/accessibility:** 320px and short phones, normal and longer copy, default and fallback fonts, RTL geometry, contrast, touch targets and reduced motion. RTL testing verifies geometry with the example copy, not Arabic/Hebrew localisation.
- **Reuse:** meaningful words remain text; photographs can replace illustrations; the design still communicates its action with images unavailable. Dates, year labels, percentages and countdown schedules are separate editable content and must be kept consistent by the merchant.
- **Catalogue:** one Christmas & New Year collection, discoverable before installation under existing Pro-hint preferences; Free items are hosted individually, never bundled in the Free ZIP.

## Per-design assessment

All entries below were reviewed as prototype candidates. “Setup” names what the merchant/native author must supply, not functionality implemented by this preview.

| # | Practical job and placement | Editor composition / reuse | Setup or constraint |
| --- | --- | --- | --- |
| 01 | Gift-collection popup | Image/text split; replace wrapping art for another season | Link to a real gift collection; use a restrained trigger |
| 02 | Simple discount popup, Free | Small circular image, live offer and code | Create the 15% code; align percentage, terms and code |
| 03 | Immersive gift-guide landing invitation | Fullscreen text/media arrangement with static landscape | Best after an intentional action; avoid repeated interruption |
| 04 | Ornament promotion with a deadline | Image split plus boxed countdown | Valid 20% promotion and genuine 20 December end date |
| 05 | Gift-guide block within a page, Free | Image/text split without an unnecessary form | Link to a useful guide or collection |
| 06 | Candle-store welcome signup | Wide image, clear incentive and single-field form | 15% welcome code, marketing destination and consent policy |
| 07 | Colourful gift-collection feature | Three equal editorial areas can use a native grid | Reflow naturally; never preserve desktop order by hiding content |
| 08 | Gift-ideas email signup, Free | Text/list panel plus form panel | Keep the list meaningful; valid 10% welcome code |
| 09 | Gift-wrapping deadline reminder | Compact message/countdown/action row | State eligible orders and actual wrapping cutoff |
| 10 | Curated Christmas collection invitation | Simplified two-pane fullscreen split | Publish a genuine collection closing date; no disappearing mobile pane |
| 11 | Seasonal letters signup, Free | Text-led letter with simple border and sign-off | Real mailing purpose and 15% welcome code |
| 12 | Editorial newsletter signup | Postcard image/form split | Clearly identify frequency/content and the 10% incentive |
| 13 | Winter-launch email signup | Wide snowglobe image, form and optional sparkles | Illustration is static; no interactive snowglobe control implied |
| 14 | Monthly gift-ideas newsletter, Free | Replaceable flower and form; no reward dependency | One email a month must match the merchant's intended mailing |
| 15 | Early-access list signup | Compact text-led dark card and divider | Explain what “first pick” means; valid 15% code |
| 16 | Time-bounded preview registration | Wide image, countdown and form | Set preview cutoff; native expiry must let an active submission finish |
| 17 | Seasonal discovery newsletter | One decorative tile image beside a form | Tiles are artwork, not a calendar game or daily unlock feature |
| 18 | Bookshop welcome signup, Free | Book image/form split | Real reading-list content and 10% offer |
| 19 | Christmas dispatch cutoff notice | Compact text-led message plus clock/action | Dispatch cutoff is not a guaranteed arrival date |
| 20 | Prominent order-cutoff popup | Framed panel with wide gift art and countdown | Date and destination should agree with delivery policy |
| 21 | Delivery-planning information block | Editable calendar number and copy panel | Calendar label, body date and countdown schedule must agree |
| 22 | Digital gift-card promotion | Large editable category label above a compact offer | Merchant must actually sell digital gift cards; no delivery-time claim |
| 23 | Last-minute digital-gift offer, Free | Text-led code/countdown card | Valid 15% code and real 24 December deadline |
| 24 | Click-and-collect cutoff bar | Clear pickup heading, explanation, clock and action | Actual pickup location, availability and cutoff needed |
| 25 | Closing Christmas collection invitation | Large ornament/text split with a clear end date | Fullscreen suits deliberate engagement; configure respectful frequency |
| 26 | January welcome signup | Dawn image/form split | Useful January content and valid 15% offer |
| 27 | Optimistic New Year inline signup, Free | Bold text panel plus form panel | Longer copy and fallback fonts wrap; 10% code configured |
| 28 | New Year sale destination | Botanical image/year panel and offer panel | Editable year, actual 20% offer and 5 January end date |
| 29 | January arrivals email signup | Wide star image above a compact form | Real arrival announcements and valid 15% incentive |
| 30 | New Year offer reminder bar | Live year, compact offer and countdown | Keep year, discount and closing date current |
| 31 | Weekly inspiration signup, Free | Small circular flower, bold heading and form | Weekly cadence must be accurate; valid 10% code |
| 32 | Holiday closure notice | Replaceable moon image and compact information/action | Real closure dates and dispatch-resumption date; no signup needed |
| 33 | Opening-hours teaser | Warm mug image and straightforward visitor action | Link to current hours; distinct from the full timetable in 35 |
| 34 | Delivery-policy notice, Free | Parcel image and concise information panel | Link to a real delivery page; no unsupported arrival guarantee |
| 35 | At-a-glance holiday timetable | Three editable date/time rows and supporting action | Update every date and time; rows are text, not a live calendar integration |

## Playful extension assessment

The five additional Pro designs were rebuilt as greeting-card compositions after the object-photography direction was rejected. Copy, ordering dates, discounts, fields and countdowns remain live. The cards are fully readable without the decorative images; no pulling, unwrapping or opening interaction is promised. Two optional native sparkles per card use the shipping decoration renderer. The complete designs still require native authoring.

| # | Visitor purpose | Composition | Merchant setup |
| --- | --- | --- | --- |
| 36 | Christmas gift offer | Ribbon framing a typographic greeting, offer inside the card | Real 20% offer ending 20 December |
| 37 | Christmas gift edit | Complete cat illustration above an expandable cream gift-box front | Relevant gift edit link; one replaceable image, live text and button; no faux interaction |
| 38 | Ordering reminder | Dispatch ticket, large editable date, dashed countdown stub | Actual order cutoff and delivery-area link |
| 39 | Gift newsletter with welcome code | Santa illustration merges into letter paper and form | Valid 15% welcome code and signup destination |
| 40 | New Year offer | Large live typography, printed trim, contrasting offer strip | Real 20% offer ending 5 January; deliberate fullscreen trigger |

Inspect all five at desktop, 320px and the 649/651px transitions, including the Santa acknowledgement. Printed backgrounds must stay behind text and may be removed as a whole. Long copy can increase card height; artwork does not contain meaningful text. No new arbitrary positioning, card-fold control, image motion or games are assumed in the editor.

### 37 replacement follow-up

Replaced the cracker with an original ginger cat on a gift lid. Reviewed the final desktop and 320px renders: the complete cat stays above the live greeting, the small-screen headline uses two balanced lines, and the close control has its own clear space. The final five-width check (320/390/649/651/1000) verifies image aspect ratio/loading, close clearance, button demonstration and longer copy. The native motion check passes enabled, paused and reduced-motion states. Evidence: `37-cat-audit.json` and `37-cat-viewer.png`. Native authoring remains pending.

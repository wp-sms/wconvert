# Small wonders — Christmas & New Year prototype

**Throwaway visual exploration, updated 23 October 2026.** Review 40 concepts before authoring native Templates. This is a Vite/HTML/CSS prototype, excluded from plugin distributions by the existing /tools rule. No native Templates, Playbooks, collections or server catalogue entries are registered or published here.

## Run and review

Run `npm run prototype:winter` from the repository root. Open http://127.0.0.1:5194/.

- Gallery: all 40, with theme, format, Free/Pro, countdown and motion filters; desktop/mobile thumbnail toggle.
- `/?variant=03`: wide winter village, desktop and phone side by side.
- `/?variant=13&phone=320`: snowglobe signup at narrow phone width.
- `/?variant=16&screen=ack`: acknowledgement for a signup with a deadline.
- `/?render=27&motion=off`: standalone visitor view at the actual browser width.
- Use the bottom switcher or arrow keys to move between concepts. Phone choices are 390px and 320px. Each preview scrolls if its content exceeds the frame height.

The viewer includes a motion pause control, signup/acknowledgement selection, and countdown expiry preview. Example email forms use native email and consent validation, then show a request acknowledgement. Fourteen signup designs reveal an example coupon; design 14 is a monthly newsletter without a coupon. Copy code writes that code to the clipboard. No address is sent, saved, subscribed or added to a Destination. Shop and information buttons show a local demonstration notice.

## Creative direction

Warm paper, illustrated gifts, botanicals, winter villages, letters and optimistic New Year typography. This batch moves away from the shopping weekend's black, chrome and neon. Compositions include two-panel invitations, personal letters, a wide village, an immersive atelier, an advent-inspired tile pattern, calendar dates, compact deadline bars, and practical opening-hours notices.

All copy remains live text. Original illustrations contain no headlines, offers or button labels. Static artwork is rendered as ordinary PNG image blocks, with a matching panel background and contain fit for complete objects. Only the wide village landscape deliberately uses cover fit. Email fields use transparent backgrounds. The ten Free concepts are spread across themes and use only Popup or Inline formats; paid display formats remain Pro.

## Proposed collection

**One Christmas & New Year collection**, proposed key `christmas-new-year`, with five themes:

| Theme | Designs | Purpose |
| --- | ---: | --- |
| Gifting | 12 | Gift guides, seasonal offers and gift-related signup |
| Signup | 9 | Winter letters, previews and welcome codes |
| Last-minute | 8 | Genuine order, dispatch and pickup deadlines |
| New Year | 7 | January offers and fresh-start signup |
| Holiday info | 4 | Opening hours, closures and delivery notices |

The five themes are prototype browse filters, not a proposal for five separate collections or new production taxonomy. On native promotion, use supported discovery tags and filters where they fit.

Display every eligible catalogue member before installation with clear Pro badges, following the existing Pro-hints visibility setting. Free users can browse Pro designs when hints are enabled. Keep all **10 Free designs as individual hosted downloads**, with none bundled in Free; the other **30 are Pro**. Installation is a per-template action, not a prerequisite for discovering the collection. Register catalogue metadata and thumbnails on the server when the approved designs become native Templates.

## Countdown and motion behaviour

16 designs use live, fixed example deadlines. The clock derives remaining time from an absolute UTC timestamp every second, so reloading does not restart it. It clamps at zero. Preview expiry uses the same transition as natural expiry: offer-only examples close; an already-open signup can still finish. Loading an example after its deadline leaves it closed. Reload example resets a manually triggered demonstration only; it cannot extend an elapsed deadline.

The sample deadlines are 1/18/20/23/24 December 2026 and 5 January 2027 at 20:00 UTC, matching the advertised calendar dates. These are review fixtures, not ready-to-publish merchant deadlines. Native promotion must connect countdowns to the Optin's end date, explicitly configure merchant dates/timezone and verify the real expiry contract. No evergreen countdown or promised delivery guarantee is implied.

13 designs include optional decorative motion. Concepts 36–40 reuse the shipping decoration renderer directly, with floating/blinking sparkles and a blinking-eyes group in 39. The earlier eight represent the same native sparkle vocabulary. Artwork itself stays static. The earlier prototype CSS motion is illustrative; the five additions use the existing renderer. No new animation runtime is introduced. Pause motion and reduced-motion preferences stop all decorative animation. Snowglobe glass, candles, ribbons and scenery do not animate.

## Editor-friendly revision — 23 October 2026

The review identified decoration that looked like a custom editor feature and object illustrations clipped by enlarged, upward-offset SVGs. The prototype now uses 36 exported PNG assets, including wide banner variants via ordinary image blocks. The source vectors remain authoring inputs only; no campaign renders custom inline SVG artwork. The shipping decoration renderer supplies its own small built-in shapes.

- Complete object illustrations use contain fit with no negative margins or enlargement. Candles, snowglobes, trees, books, gifts and mugs stay intact at desktop and phone widths. Surrounding image panes match the asset background, including the entire reading-room left column.
- Removed the postage stamps in 11 and 12, the oversized arrow in 27, the extra mark in 09 and the arrows inside primary buttons. Buttons now use simple centred text, matching the native button vocabulary.
- The moon mark in 32 and flowers in 14/31 are regular replaceable images. The native icon chooser supports check, star, bolt, gift, clock and truck; these custom symbols are not part of that list. An image can be replaced/removed as a whole; its internal drawing is not separately editable.
- The decorative tile pattern in 17 is one image without pretend calendar numbers. Removed CSS-only blend treatment, vertically written year text and the letter's repeating-border effect. The year, calendar deadline and all meaningful copy remain live text.
- Decorative motion remains independent of ordinary image replacement. The playful extension below adds native blinking eyes as well as sparkles.

Regenerate the original raster assets with `node tools/design-library/winter-prototype/rasterize-art.mjs`. No new editor controls or native runtime behaviour are introduced in this prototype revision.

## Practical review — 23 October 2026

[The full review](review/practical-review.md) assesses every design for visitor value, placement, editor composition, content resilience and merchant setup. It records the changes to copy, touch controls, field contrast, image sizing, plain-newsletter signup and misleading urgency. The 480-case stress report covers longer copy, fallback fonts and RTL at three widths; additional checks cover short-phone submission and meaning without artwork. The batch remains a prototype pending native authoring and WordPress verification.

## Playful additions — 36–40

Five more Pro concepts bring the batch to **40: 30 Pro / 10 Free**, with 16 countdowns and 13 motion treatments. They stay in the same proposed collection and existing theme filters. The gallery links directly to the additions.

- **36 / Yeti, set, gift:** a big gift-carrying yeti, bold offer text and a real 20 December countdown. Popup.
- **37 / The gingerbread bakery:** a cookie storefront, rounded image pane and a clear bakery shop action. Inline.
- **38 / Special snow delivery:** a penguin courier on a sled, with an 18 December order cutoff. Slide-in.
- **39 / No peeking club:** a cat inside a gift, a 15% signup and an independent blinking-eyes strip, using the Halloween decoration vocabulary. Popup.
- **40 / The tiny party:** rabbit-and-cat party artwork, oversized sale typography and a quiet countdown panel ending 5 January. Fullscreen.

Every illustration is a replaceable PNG; the new character images have transparent backgrounds so native decorations can sit behind them. Each has a matching panel colour, with a matching wide cat image on the acknowledgement. Characters stay static: floating or blinking decorations sit in the artwork panels, not over forms or buttons. The blinking-eyes strip is an independently removable decoration group; it does not animate or track the cat's face. No shake-the-globe, spin-to-win or pretend gift-unwrapping interaction is implied. Pause and reduced motion leave the complete design readable.

Wrapped consent labels now align the checkbox with the first text line, with a 3px optical offset. The entire label remains clickable and at least 44px tall. It should not be centred against the combined height of multiple lines.

## Native promotion boundaries

Re-author approved concepts using the manifest's closed node vocabulary and stable IDs, palette tokens, supported breakpoints, native fields, countdown leaves and decoration items. Prototype CSS and SVG must not be imported as arbitrary editor features. Reuse the exported PNG illustrations as supported image assets, adding production rights records and previews. Preserve editable headlines, calendar labels, offer copy, fields and codes outside those assets.

Re-check every design through the native renderer on desktop and mobile, with long copy, real editor controls, real signup and acknowledgement contracts, held-reward states where applicable, Pro/Free installation and discovery, and WordPress boot/runtime validation. This prototype does not prove those production behaviours. Existing form conversion and reward flows remain authoritative; the visual prototype does not introduce a new signup or reward mechanism.

## Review evidence

- Chromium layout audit: all 40 at 320, 390, 649, 651, 768, 1000 and 1440px; no horizontal page/card overflow, clipped checked text, offscreen close controls or browser errors.
- All 15 acknowledgement views at 320, 390 and 1000px; no horizontal overflow.
- Visual review: desktop and 320px contact sheets for all 40, plus all 15 acknowledgement views. Narrow atelier/tomorrow layouts and the village panorama were corrected during review.
- Gallery and viewer inspected at 320, 390 and 1440px; no horizontal page overflow.
- Interaction review: filters and counts, keyboard/selector navigation, phone width, pause, acknowledgement switching, all 15 forms and the 14 signup coupon copies, all 16 deadline calculations and simulated expiries, natural countdown expiry, expired initial loads, reduced motion, close/reopen.
- Production-build check: `npx vite build --config tools/design-library/winter-prototype/vite.config.mjs`.

`review/layout-audit.json`, `review/functional-audit.json`, `review/stress-audit.json`, `review/contrast-audit.json` `review/practical-audit.json` and `review/playful-audit.json` record the prototype checks. Contact sheets are visual review references; live clocks may differ when reopened. These are prototype-browser checks, not WordPress verification or native-template approval.

## Inventory

| # | Concept | Theme | Format | Plan | Countdown | Motion |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | The ribbon room | Gifting | Popup | Pro | — | — |
| 02 | A little gift | Gifting | Popup | Free | — | — |
| 03 | Winter windows | Gifting | Fullscreen | Pro | — | Sparkles |
| 04 | The ornament edit | Gifting | Popup | Pro | Yes | Sparkles |
| 05 | Paper & pine | Gifting | Inline | Free | — | — |
| 06 | The candle club | Gifting | Slide-in | Pro | — | — |
| 07 | Wrapped in colour | Gifting | Inline | Pro | — | — |
| 08 | The thoughtful list | Gifting | Inline | Free | — | — |
| 09 | A ribbon reminder | Gifting | Floating bar | Pro | Yes | — |
| 10 | The gift atelier | Gifting | Fullscreen | Pro | Yes | Sparkles |
| 11 | Dear December | Signup | Popup | Free | — | — |
| 12 | Postcards from winter | Signup | Inline | Pro | — | — |
| 13 | The snowglobe society | Signup | Popup | Pro | — | Sparkles |
| 14 | A small kindness | Signup | Inline | Free | — | — |
| 15 | After-hours at the atelier | Signup | Slide-in | Pro | — | — |
| 16 | First light access | Signup | Slide-in | Pro | Yes | Sparkles |
| 17 | The advent letter | Signup | Inline | Pro | — | — |
| 18 | The winter reading room | Signup | Popup | Free | — | — |
| 19 | The last sleigh | Last-minute | Floating bar | Pro | Yes | — |
| 20 | Before the bow | Last-minute | Popup | Pro | Yes | — |
| 21 | The dispatch desk | Last-minute | Inline | Pro | Yes | — |
| 22 | The digital gift | Last-minute | Slide-in | Pro | Yes | — |
| 23 | Still time for something | Last-minute | Popup | Free | Yes | — |
| 24 | The pickup window | Last-minute | Floating bar | Pro | Yes | — |
| 25 | A final little sparkle | Last-minute | Fullscreen | Pro | Yes | Sparkles |
| 26 | A softer beginning | New Year | Popup | Pro | — | — |
| 27 | Hello, tomorrow | New Year | Inline | Free | — | — |
| 28 | The midnight garden | New Year | Fullscreen | Pro | Yes | Sparkles |
| 29 | A bright new chapter | New Year | Slide-in | Pro | — | Sparkles |
| 30 | The first page | New Year | Floating bar | Pro | Yes | — |
| 31 | Fresh start club | New Year | Popup | Free | — | — |
| 32 | The shop is sleeping | Holiday info | Floating bar | Pro | — | — |
| 33 | See you by the fire | Holiday info | Slide-in | Pro | — | — |
| 34 | Holiday post | Holiday info | Inline | Free | — | — |
| 35 | Winter hours | Holiday info | Slide-in | Pro | — | — |
| 36 | Yeti, set, gift | Gifting | Popup | Pro | Yes | Sparkles |
| 37 | The gingerbread bakery | Gifting | Inline | Pro | — | Sparkles |
| 38 | Special snow delivery | Last-minute | Slide-in | Pro | Yes | Sparkles |
| 39 | No peeking club | Signup | Popup | Pro | — | Eyes + sparkles |
| 40 | The tiny party | New Year | Fullscreen | Pro | Yes | Sparkles |

## Assets and rights

Artwork in art.mjs and playful-art.mjs is original vector source authored for this prototype and exported to assets/art/*.png by rasterize-art.mjs; no external photos, logos or generated stock images are included. DM Sans (regular/bold) and Instrument Serif (regular) are local copies of the existing commerce prototype fonts. Their SIL Open Font License notices are included in assets/. No Google Fonts request or external media request occurs at runtime. Production font delivery continues to follow WConvert's font permission rules.

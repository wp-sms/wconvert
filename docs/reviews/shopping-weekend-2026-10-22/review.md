# Shopping weekend: 20 native templates

All twenty approved prototype concepts are now bundled designs with matching Playbooks. Ten are Free and ten use Pro display types. The batch spans six popups, four floating bars, four slide-ins, four inline forms and two fullscreen presentations. Four signup setups add acknowledgements, for 24 authored screens. Six offer designs include native countdowns.

## Review decisions

| Prototype | Setup | Specific review |
| --- | --- | --- |
| 01 | `bf-midnight-atelier` | Clean shopping still life beside editorial serif copy; the image contains no text. Mobile stacks image above the offer. |
| 02 | `bf-acid-markdown` | Acid yellow sale card with a strong typographic hierarchy and editable discount; no flattened promotional copy. |
| 03 | `bf-early-list` | Burgundy invitation and cream signup panel; required email, explicit consent and a separate honest coupon acknowledgement. The prototype stamp becomes an editable badge. |
| 04 | `bf-good-deal-receipt` | Receipt typography, rules and saving summary; long monospace copy wraps within the narrow slide-in. |
| 05 | `bf-blackout-strip` | Compact black-and-lime offer strip. Phone layout stacks the button and reserves space for dismissal. |
| 06 | `bf-weekend-edition` | Newspaper-style inline split, with the discount/coupon in its own column; the columns stack on phones. |
| 07 | `bf-velvet-rope` | Full-screen invitation with clean shopping imagery and a labelled, high-contrast field. Native scrolling preserves access to the form on small screens. |
| 08 | `bf-little-black-gift` | Pink gift slide-in with original image artwork, editable headline and native coupon copy control. |
| 09 | `cm-chrome-hour` | Chrome sculpture without image text, electric-blue offer panel, and readable native links/copy controls. |
| 10 | `cm-system-upgrade` | Lilac system card with an aligned header close control. Removed unexplained CM/01 notation; discount remains editable. |
| 11 | `cm-command-save` | Lavender shortcut-inspired bar. The command-S badge is decorative text; the real button follows the configured offer link. |
| 12 | `cm-pixel-drop` | Pixel gift and monospace headline; labelled email field, consent, retry-safe capture and separate coupon acknowledgement. |
| 13 | `cm-electric-aisle` | Electric-blue inline offer with a cropped chrome image, editable saving and separate coupon action. |
| 14 | `cm-night-shift` | Dark green compact countdown bar; native boxed units remain readable on phones and drop the days box in the final day. |
| 15 | `cm-cyber-club` | Lavender club signup with a rounded editable offer panel, labelled email field and separate coupon acknowledgement. |
| 16 | `bf-final-markdown` | Rust-and-cream countdown popup, with native unit labels and deadline editing. Phone layout keeps the clock between offer and action. |
| 17 | `bf-closing-time` | Two-tone yellow/olive closing-time slide-in; line countdown and inverted call to action stay readable under preset changes. |
| 18 | `cm-digital-after-hours` | Ice-blue inline split with a dark clock panel; stacks vertically on mobile without horizontal scrolling. |
| 19 | `cm-midnight-transmission` | Navy fullscreen transmission; large boxed clock adapts to a two-column clock on the narrow layout. |
| 20 | `bf-weekend-curtain` | Cream-and-burgundy closing strip with a line countdown. Mobile stacks content with clear dismissal space. |

## Verification

- Normal and longer-copy layout audits: 1,536 cases across 320, 390, 520, 640, 768, 960, 1280 and 1440 px, in both directions; no overflow, close collisions, small controls or contrast flags.
- Midnight and Minimal presets: 96 screen/width checks, including RTL. Fields use visible labels instead of faint example placeholders. The audit ignores placeholder contrast when no placeholder exists.
- All 20 studio journeys complete. WordPress checks at 320 and 1280 px verify real rendering, links, invalid/empty-input refusal, consent, failure/retry and local capture where applicable. See `results.json`.
- Six countdowns at two viewport sizes: ticking, hiding zero days, real code copying where applicable, stable deadlines across page navigation for overlays, and closing the visible offer at expiry. The inline countdown is tested on its embedded page. See `countdowns.json` and the live screenshots.
- Countdown browser tests advance time using Playwright; its missing navigation performance entry is shimmed for the WordPress theme’s DOM-ready check. The regular WordPress journey run uses the unmodified theme and real browser clock.
- In WordPress admin, selected The final markdown through the creation picker, edited the hours label, set November 30, 2026 at 23:59 in the countdown inspector, selected Mobile and saved the unpublished draft. The inspector confirms that this is the campaign schedule end; screenshot: `editor-countdown-mobile.png`.
- The loader’s expiry regression tests cover all five display types and a deadline over 25 days away. Expiry is not a visitor dismissal. Existing in-progress signup/reopen behaviour remains intact (ADR 0104).

## Native editor adaptations

Images remain replaceable; all headings, discounts, labels, coupon values and actions are native editable elements. Rotated stamps and circular text use the existing badge/rounded-panel vocabulary. Native coupon copy controls are used. Coupon values and offer URLs must be configured before publication; no fake discount is silently activated. Countdown templates require a real end date in the WordPress site timezone and never reset per visitor. With no date the live clock remains empty and the editor explains why.

The two generated photographs and the two original gift illustrations have provenance/rights records. Exact hash-named WebP copies are served as cacheable local assets rather than inline page payloads. Optional fonts retain readable local fallbacks and do not enable remote font delivery.

The separate flow-conversion enhancement remains in issue #322. This change does not claim coupon validation in a third-party store or external email/SMS delivery. See the shared review README for the standing limits.

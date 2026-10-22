# Shopping weekend: 20 native templates

All twenty approved prototype concepts are native designs with matching Playbooks. Fifteen ship in Pro. Five are Free catalogue downloads and ship in neither ZIP: Acid markdown, The early list, The weekend edition, The cyber club and Digital after hours. The Free selection covers both sale events, two signup journeys and a countdown. No shopping-weekend design, Playbook or artwork is bundled in Free. The batch spans six popups, four floating bars, four slide-ins, four inline forms and two fullscreen presentations. Four signup setups add acknowledgements, for 24 authored screens. Six offer designs include native countdowns.

## Review decisions

| Prototype | Setup | Availability | Specific review |
| --- | --- | --- | --- |
| 01 | `bf-midnight-atelier` | Pro | Clean shopping still life beside editorial serif copy; the image contains no text. Mobile stacks image above the offer. |
| 02 | `bf-acid-markdown` | Free catalogue download | Acid yellow sale card with a strong typographic hierarchy and editable discount; no flattened promotional copy. |
| 03 | `bf-early-list` | Free catalogue download | Burgundy invitation and cream signup panel; required email, explicit consent and a separate honest coupon acknowledgement. The prototype stamp becomes an editable badge. |
| 04 | `bf-good-deal-receipt` | Pro | Receipt typography, rules and saving summary; long monospace copy wraps within the narrow slide-in. |
| 05 | `bf-blackout-strip` | Pro | Compact black-and-lime offer strip. Phone layout stacks the button and reserves space for dismissal. |
| 06 | `bf-weekend-edition` | Free catalogue download | Newspaper-style inline split, with the discount/coupon in its own column; the columns stack on phones. |
| 07 | `bf-velvet-rope` | Pro | Full-screen invitation with clean shopping imagery and a labelled, high-contrast field. Native scrolling preserves access to the form on small screens. |
| 08 | `bf-little-black-gift` | Pro | Pink gift slide-in with original image artwork, editable headline and native coupon copy control. |
| 09 | `cm-chrome-hour` | Pro | Chrome sculpture without image text, electric-blue offer panel, and readable native links/copy controls. |
| 10 | `cm-system-upgrade` | Pro | Lilac system card with an aligned header close control. Removed unexplained CM/01 notation; discount remains editable. |
| 11 | `cm-command-save` | Pro | Lavender shortcut-inspired bar. The command-S badge is decorative text; the real button follows the configured offer link. |
| 12 | `cm-pixel-drop` | Pro | Pixel gift and monospace headline; outlined email field on the dark surface, consent, retry-safe capture and separate coupon acknowledgement. |
| 13 | `cm-electric-aisle` | Pro | Electric-blue inline offer with a cropped chrome image, editable saving and separate coupon action. |
| 14 | `cm-night-shift` | Pro | Dark green compact countdown bar; native boxed units remain readable on phones and drop the days box in the final day. |
| 15 | `cm-cyber-club` | Free catalogue download | Lavender club signup with an outlined editable seal, labelled email field and separate coupon acknowledgement. |
| 16 | `bf-final-markdown` | Pro | Rust-and-cream countdown popup, with native unit labels and deadline editing. Phone layout keeps the clock between offer and action. |
| 17 | `bf-closing-time` | Pro | Two-tone yellow/olive closing-time slide-in; line countdown and inverted call to action stay readable under preset changes. |
| 18 | `cm-digital-after-hours` | Free catalogue download | Ice-blue inline split with a dark clock panel; stacks vertically on mobile without horizontal scrolling. |
| 19 | `cm-midnight-transmission` | Pro | Navy fullscreen transmission; large boxed clock adapts to a two-column clock on the narrow layout. |
| 20 | `bf-weekend-curtain` | Pro | Cream-and-burgundy closing strip with a line countdown. Mobile stacks content with clear dismissal space. |

## Verification

- Normal and longer-copy layout audits: 1,536 cases across 320, 390, 520, 640, 768, 960, 1280 and 1440 px, in both directions; no overflow, close collisions, small controls or contrast flags.
- Midnight and Minimal presets: 96 screen/width checks, including RTL. Fields use visible labels instead of faint example placeholders. The audit ignores placeholder contrast when no placeholder exists.
- All 20 studio journeys complete. WordPress checks at 320 and 1280 px verify real rendering, links, invalid/empty-input refusal, consent, failure/retry and local capture where applicable. See `results.json`.
- Six countdowns at two viewport sizes: ticking, hiding zero days, real code copying where applicable, stable deadlines across page navigation for overlays, and closing the visible offer at expiry. The inline countdown is tested on its embedded page. See `countdowns.json` and the live screenshots.
- Countdown browser tests advance time using Playwright; its missing navigation performance entry is shimmed for the WordPress theme’s DOM-ready check. The regular WordPress journey run uses the unmodified theme and real browser clock.
- In WordPress admin, selected The final markdown through the creation picker, edited the hours label, set November 30, 2026 at 23:59 in the countdown inspector, selected Mobile and saved the unpublished draft. The inspector confirms that this is the campaign schedule end; screenshot: `editor-countdown-mobile.png`.
- The loader’s expiry regression tests cover all five display types and a deadline over 25 days away. Expiry is not a visitor dismissal. Existing in-progress signup/reopen behaviour remains intact (ADR 0104).

## Tier and packaging follow-up

The collection uses the requested 15 Pro / 5 Free split. The five Free designs and their Playbooks live under `tools/design-library/hosted/` and download through the existing catalogue flow; neither ZIP contains them. All fifteen Pro designs and their Playbooks ship in Pro. All shopping-weekend artwork is marked premium and lives only in Pro's bundle. Older bundled Free designs are unchanged.

Built both release ZIPs with `bin/build.sh all`; both passed the artifact contract. Inspected the actual archives: no shopping-weekend design, Playbook or artwork in Free, exactly fifteen in Pro, and no hosted sources in either ZIP. See `packaging.json`. Template registration and source-boundary checks pass. All 20 WordPress journeys were rerun after relocation, giving 40 passes, and all 20 studio journeys passed again. All twelve live countdown checks also passed again. A local catalogue release passed the shipping PHP reader for 91 designs and 114 setups; its public objects contain exactly these five Free designs/setups, and its private objects contain all fifteen Pro designs/setups and premium artwork. This is a local release validation, not a production catalogue deployment.

## Prototype fidelity follow-up

Compared the approved prototype gallery and its composition/style source with the native screens. Five avoidable differences were corrected:

- **02 Acid markdown:** made the editable percentage bold and larger than the surrounding heading, bounded so longer merchant copy still fits a phone.
- **07 Behind the velvet rope / 12 Pixel drop:** removed the extra filled field wrapper and its padding. Email now sits directly on the dark surface with an outline and visible label. Field borders follow foreground contrast through theme changes.
- **10 System upgrade:** removed the invented lime title-strip fill. It now uses the light lavender surface, with a clear aligned close control. The exact prototype's off-white title strip is simplified to the native palette.
- **15 The cyber club:** replaced the filled card with an outlined rounded seal and a subtle introduction-pane shade. Its words and discount stay editable; it is not rotated or fixed to a circle.

The four signup designs were checked against the prototype's field treatment. 03 intentionally retains its cream ticket; 15 retains its lavender form surface. The native coupon copy control, badge simplifications, image reflow and real countdown units remain editor adaptations rather than pixel-for-pixel HTML imports.

Recaptured and inspected desktop and 320px phone screens, including acknowledgements. Inspected longer CTA labels immediately around the split transitions: Velvet rope at 679/680px and Cyber club at 639/640px. Reading order stays image/offer then form; the longer CTA wraps inside its column without separating the field from its action. The transition contact sheets are saved alongside the focused WordPress results. Reran normal/long-copy layout audits and Midnight/Minimal RTL checks after the final edits. The existing live countdown evidence applies unchanged: none of these styling changes alters countdown designs or runtime code. Final focused WordPress results are also saved under `../shopping-weekend-alignment-2026-10-22/results.json`.

## Native editor adaptations

Images remain replaceable; all headings, discounts, labels, coupon values and actions are native editable elements. Rotated stamps and circular text use the existing badge/rounded-panel vocabulary. Native coupon copy controls are used. Coupon values and offer URLs must be configured before publication; no fake discount is silently activated. Countdown templates require a real end date in the WordPress site timezone and never reset per visitor. With no date the live clock remains empty and the editor explains why.

The two generated photographs and the two original gift illustrations have provenance/rights records. Exact hash-named WebP copies are served as cacheable local assets rather than inline page payloads. Optional fonts retain readable local fallbacks and do not enable remote font delivery.

The separate flow-conversion enhancement remains in issue #322. This change does not claim coupon validation in a third-party store or external email/SMS delivery. See the shared review README for the standing limits.

# Twelve flagship starting points — 11 September 2026

The creation flow now offers twelve complete starts across three audiences.
Eleven reuse existing designs; **Reading slip** is the only new composition.
The library contains 50 designs: 37 Free and 13 Basic, with 29 popups, 13 inline
designs, four floating bars and four slide-ins. The flagship selection uses
popup and inline placements; the previously reviewed bars and slide-ins remain
available in the wider library. No templates were moved between tiers.

| Audience | Starting point | Design | Remaining setup |
|---|---|---|---|
| Stores | Welcome discount | Fieldwork | Brand, picture, valid 10% code, offer terms, email destination |
| Stores | The welcome ticket | Punched ticket | Brand, valid 15% code, terms, monthly email destination |
| Stores | The summer archive sale | The summer archive | Sale URL, actual prices and terms, schedule and time zone |
| Stores | A quiet return to the cart | Inline call to action | Block placement; WooCommerce and the paid cart capability |
| Publishers | The Sunday letter | Sunday marginalia | Publication name, real excerpt, cadence and email destination |
| Publishers | At the end of the article | Inline rule | Block at article end, cadence and email destination |
| Publishers | A useful little guide | A useful little guide | Actual resource, brand, delivery destination, optional success URL |
| Publishers | One more good read | Reading slip | Placement, real article title and destination |
| Services | Request a callback | Callback notes | Placement, topics and a process to respond to Leads |
| Services | Request a quote | Inline choice | Placement, service choices and response workflow |
| Services | An invitation to consult | Photo offer | Picture, service-page targeting and existing booking URL |
| Services | The pre-launch checklist | Ready for launch | Actual checklist, brand, delivery destination, optional success URL |

## What changed

Recommendations appear first within the selected Goal, with “Recommended for
stores”, “Recommended for publishers” or “Recommended for services”. The
audience is guidance, not a new filter or restriction. The card and created
draft receive the same PHP `Prefill` result. Five Playbooks were added and
existing starts were updated; merchant snapshots remain independent.

Repeated copy roles are filled in tree order, including both screens, optional
consent and resource labels. The weekly Sunday copy is consistent. The old
reader-discount mismatch and unsupported cart retention promises were removed.
The immediate cart option is a restrained inline card. Consultation links count
clicks, not bookings; callbacks acknowledge a request. The two resource starts
name the delivery setup and optional non-converting download explicitly.

Reading slip adapts the static reference's compact editorial receipt into a
single direct reading invitation. It has no capture or unsupported email-basket
promise. Existing images remain editable placeholders; no imagery was generated.

## Reproduce the review

Run `./tools/design-library/build.sh renderer starting-points`, then open
[the twelve starts](http://wconvert.local/wp-content/plugins/wconvert/tools/design-library/out/starting-points.html).
The generator reads the single collection membership and calls the shipping
Prefill; it does not reproduce copy binding in JavaScript. The portable review
supplies all rule capabilities and labels its difference from the installed app.
Brand names, codes and destination URLs are intentionally blank in these drafts.

The collection passed **320 rendered cases** at 320, 390, 768 and 1440 pixels,
LTR and RTL, normal and longer copy with consent, across all twenty screens.
No cases failed the checks for horizontal overflow, controls below 44px, input
text below 16px or solid-colour text/placeholder contrast. Tall phone layouts
still need vertical scrolling. These measurements are not a complete
accessibility audit or approval of a later photograph.

Real WordPress REST verification compared the chooser previews to prefill,
created and read back all eleven locally available flagship drafts, then removed
those temporary drafts. All six original saved Optins were unchanged. Cart
creation was correctly unavailable without WooCommerce; store-enabled tests
cover its prefill, cart condition and empty URL for runtime cart resolution.
The live Pro admin chooser showed the recommendation labels and kept other
starts available. A reading-slip draft opened correctly in the editor; desktop,
mobile, Midnight and Minimal palettes were visually checked. Undo restored the
original appearance with Save draft disabled, and that temporary draft was
removed too. No campaign was published and no leads or external delivery
messages were sent.

Validation: 1,846 PHP tests / 8,516 assertions; 2,308 JavaScript tests across
94 files; TypeScript, ESLint, PHPStan, template registration, source contract and
both Free and Pro admin builds passed. Tests cover complete copy, merchant-owned blanks,
distinct collection membership, recommendation order, extension retention and
preview-to-draft identity. Visitor renderer and loader code were not changed.

## Next

After reviewing and merging this collection, implement the bounded catalog
installation path: versioned template data, capability checks, asset validation,
local installed copies, offline fallback and useful update/error states. Keep
existing campaigns independent of catalog refreshes. Restock binding, emailed
baskets, optional SMS after email and richer enquiry fields remain separate
product work, not promises hidden in template copy.

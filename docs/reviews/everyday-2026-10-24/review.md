# Everyday, extraordinary — implementation review

The 50 approved prototypes are imported as native v2 Templates and matching Playbooks: 35 Pro and 15 individually hosted Free designs, with 88 screens across five display formats. The collection is catalogue-only so all 50 can be discovered before installation without adding Pro designs to the Free ZIP.

## Fidelity and production configuration

`fidelity.json` checks every layout node, wide/narrow style, copy value, role, screen order, artwork identity and tier against the reviewed prototype. Artwork is WebP-encoded without changing its canvas or aspect ratio. Repeated copy roles are extracted with the shipping SlotRoles implementation, preserving their separate values.

Production adaptations are explicit: consent visibility follows the Goal; empty action URLs are merchant configuration; resource followups start hidden until their URL and visibility are configured; coupon values and campaign end dates are site-owned. The WordPress fixture configures these actions and opens the acknowledgement resources. No live provider delivery is asserted.

The fonts are declared in each native tree. The preview loads the licensed local DM Sans and Instrument Serif faces. Visitor sites must serve these through their theme/Font Library or explicitly enable the existing Google Fonts option; otherwise native fallbacks apply. Importing a template does not enable remote font delivery.

The approved multi-colour compositions deliberately retain their scoped editable colours. Their actual literal-colour counts are recorded as an import baseline, rather than changing the approved palettes to fit the seven global colour slots. This is a fidelity exception to the new-design colour guideline: a future global Brand palette will not automatically recolour those scoped panels. The count ratchet and publisher contrast checks remain active.

Small corrections were applied to both prototype and native source during review: touch close clearance, the record caption contrast, and the newsletter bar wrapping. The checklist’s doubled spaces were also reduced to single spaces for the publisher copy check. No shared renderer or runtime schema changed.

## Verification

- `results.json`: all 50 configured setups, phone and desktop, on WordPress 6.8.3 / PHP 8.1 Playground. Validations, consent, temporary failure/retry, local Lead persistence, acknowledgement, link actions and coupon copy.
- `layout.json`: every screen at eight widths, LTR/RTL, normal and longer copy; source designs and prepared setups.
- `countdowns.json`: saved deadline, ticking, refresh, zero-day display, expiry and in-progress signup behaviour for all ten countdown designs.
- `<id>-320.png` / `<id>-1440.png`: all prepared screens captured with the native renderer. Reviewed also as 22 boards pairing actual phone and fitted desktop views.
- `fidelity.json`: exact structural handoff check for all 50.
- `editor-desktop.png` / `editor-mobile.png`: Sunday crumb created through the real WordPress picker, with native editable layers and local theme font delivery. The acknowledgement and its coupon controls were opened in the editor. `visitor-desktop.png` confirms the actual published popup with the same local fonts.
- `collection.json`: all 50 references resolve; 35 Pro / 15 hosted Free, with no new Free entry bundled. The collection uses the existing pre-install catalogue discovery path.

## Per-design visual judgement

- **01 · Sunday crumb (free)** — The bakery photograph retains its full canvas; the butter-colour panel runs the full desktop height and becomes compact above the phone form.
- **02 · The object room (pro)** — The cobalt heading remains the focus; the chair panel loses the unnecessary phone-height floor while retaining its caption.
- **03 · Listening party (pro)** — The headphones poster and yellow signup area stay distinct. Boxed countdown wraps into a centred two-by-two group on narrow phones.
- **04 · Almost somewhere (pro)** — The panoramic travel image remains a separate band; the compact desktop signup becomes a readable vertical phone form.
- **05 · Bloom notes (free)** — The poppy sits in a full-height cream panel. The monthly frequency is clear and the acknowledgement keeps the artwork.
- **06 · Good dog society (pro)** — The terrier is one replaceable image. The welcome coupon is revealed only after the signup acknowledgement.
- **07 · The lemon hour (free)** — The lemon poster is a direct offer with a copyable coupon; the discount and terms remain readable beneath the artwork.
- **08 · School of small things (pro)** — The octopus does not crowd the learning offer. Its panel moves below the form on mobile; the exercise URL must be configured.
- **09 · Soft science (pro)** — The skincare photo remains beside the preview form on desktop and above it on mobile, without a contrasting input fill.
- **10 · Frame by frame (free)** — The camera panel reaches the bottom edge. The short desktop field/action row stacks comfortably on phones.
- **11 · The daily ritual (pro)** — The coffee artwork and curved lower corner survive the narrow slide-in. The brew-guide action needs its actual resource URL.
- **12 · Permission to pause (free)** — The sleeping fox stays fully visible in the arch. Additional upper clearance keeps the touch close control away from the eyebrow.
- **13 · Open atelier (pro)** — The orange sale poster keeps its large discount block and four-part timer. The merchant must align the written deadline with the schedule.
- **14 · The reading shelf (free)** — Three editable book-cover panels remain readable across the phone width; the main signup sits clearly below them.
- **15 · The small-start studio (pro)** — The three numbered learning steps stack on phones and remain side by side on desktop. The free lesson is an acknowledgement resource.
- **16 · Out of office (pro)** — The travel offer remains a compact desktop bar; the phone version centres the countdown without squeezing the action.
- **17 · The long weekend pass (pro)** — The two-part pass retains its native ticket edge. Its wording promises a guide after a request, not a booking.
- **18 · Small batch bulletin (free)** — The material and finish ledger stays editable and distinct from the main heading. The form shares the full-height coloured panel.
- **19 · Better together (pro)** — The oversized two-for-price panel remains a strong second column. Extra top clearance also accommodates long translated headings.
- **20 · Make it yours (pro)** — The monogram uses editable type rather than an image. The enquiry acknowledgement confirms receipt only.
- **21 · One good idea (free)** — The typographic newsletter uses one clear weekly promise. Consent wraps beneath its button without crowding.
- **22 · The next chapter (pro)** — The inset chapter-cover panel deliberately keeps its frame. The author signup and opening-chapter resource remain separate actions.
- **23 · Listen closer (pro)** — The episode label is editable text in a small coloured panel. The link-only bar has clear close-button clearance.
- **24 · A note from the maker (pro)** — The founder note keeps its letter-like hierarchy and one signup action. The signature remains editable copy.
- **25 · The useful checklist (free)** — The checklist contents form a full-height side panel and stack after the form on phones. The download target belongs on acknowledgement.
- **26 · Build something good (pro)** — The early-access request has a distinct lime countdown panel. The acknowledgement does not claim that an account has been created.
- **27 · Room in your inbox (pro)** — The newsletter bar now places the message above its compact form at desktop widths, preventing a stranded wrapped button with longer copy.
- **28 · The listening room (pro)** — The record illustration keeps its full canvas. Its dark caption was adjusted slightly to pass contrast; the timer remains centred.
- **29 · A date with making (free)** — The inset calendar card retains its deliberate margins. The enquiry text explicitly avoids confirming a workshop place.
- **30 · Start a conversation (pro)** — The service selector, name and email make a practical enquiry. Touch close clearance is reserved above the heading.
- **31 · A desk away (pro)** — The cobalt workspace layout uses the chair as a full-height desktop panel, while the phone image has a compact natural height.
- **32 · Fix-it Friday (pro)** — The repair note fits the slide-in format and uses only name and email. Assessment and pricing remain explicitly separate.
- **33 · Your kind of weekend (pro)** — The three short local-interest panels stay horizontal on phones. The newsletter has a specific nearby-events promise.
- **34 · An occasion worth keeping (free)** — The flower artwork is not cropped at the edges. The request asks about an occasion without implying availability or a reservation.
- **35 · From the ground up (pro)** — The gardening illustration is one replaceable asset. The phone version removes the large image-height floor while keeping the guide form legible.
- **36 · A fresh start (pro)** — The sale bar centres its narrow countdown and leaves a touch-sized close area above the phone content.
- **37 · The comfort zone (free)** — The rounded fox signup has a clear first-order reward. The coupon appears on acknowledgement and copies through the native control.
- **38 · An evening worth making (pro)** — The supper offer uses a warm menu panel with a centred timer. Booking and payment are clearly completed on the linked page.
- **39 · Slow Sunday notes (pro)** — The coffee letter remains a quiet slide-in with a monthly promise; the acknowledgement keeps the same visual hierarchy.
- **40 · The little-things shop (pro)** — The orange welcome offer is typographic and fully editable. The code is separate from the persistent ten-percent panel.
- **41 · A curious future (pro)** — The octopus and cobalt learning form retain their distinct columns; the mobile artwork sits below the form without excess vertical space.
- **42 · The weekend court (free)** — The tennis illustration fills its coloured panel without requiring individual icon editing. The beginner guide remains a configured resource.
- **43 · Another good round (pro)** — The restoration selector fits above name and email. The acknowledgement correctly leaves assessment to a later conversation.
- **44 · Before the drop (pro)** — The dark release bar gives the boxed timer a centred narrow layout and keeps the link separate from the close control.
- **45 · The curious corner (pro)** — The red issue header gives the slide-in a distinct identity. Its newsletter action and consent remain comfortably spaced.
- **46 · The scenic route (pro)** — The travel photo is a low strip below the form, preserving the scenic-route concept without dominating the phone layout.
- **47 · First light journal (free)** — The geometric sunrise is a replaceable image in a full-height panel. The form remains compact with a clear weekly-letter promise.
- **48 · The useful sale (pro)** — The sale percentage is native editable type in a dark panel. The timer fits both four-column desktop and centred phone arrangements.
- **49 · A little thank-you (free)** — The thank-you offer is an inline coupon, with no unnecessary capture step. Its terms sit below the copy and shop actions.
- **50 · The future is friendly (pro)** — The planetary illustration stays simple and replaceable. The countdown supports a preview request, and acknowledgement does not promise access.

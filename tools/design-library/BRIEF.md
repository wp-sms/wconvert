# WConvert designs — collection brief

WConvert captures leads through popups, inline forms, floating bars and slide-ins.
The collection must serve stores, publishers and service businesses equally well.
Quality and a useful visitor outcome determine whether a design earns a place.

## The current editor

The builder has a selectable preview, contextual controls and optional Layers.
Merchants can edit text, fields, images, fonts, layout parameters and scoped
styles; insert, duplicate, remove and reorder blocks; edit both form and success
screens; and use mobile style overrides and undo. A template must be useful
before any of those controls are touched. See ADRs 0067, 0075 and 0076.

The initial task is three representative designs, including substantial
improvements of existing entries. A larger twelve-design collection follows
after these examples establish the standard. Do not count palette changes as
additional designs or remove existing entries before reviewing their dependants.

## First three examples

| Audience | Design | Starting point | Placement |
|---|---|---|---|
| Stores | Fieldwork | Refined split offer, gradient placeholder, visible code reveal | Free popup |
| Publishers | Sunday marginalia | Refined editorial letter, readable type, complete acknowledgement | Free popup |
| Services | Callback notes | New callback request, phone plus optional name and topic | Free inline |

All three belong in Free to establish strong examples for each audience.
Pro follows the same quality standard and adds compositions, coordinated
collections and its additional display types. The later curation target is
roughly 12–16 Free and 24–32 Pro designs, not a quota for this batch.

The library after this batch contains 57 designs: 39 Free and 18 Pro. Treat
that as a dated inventory, not a constant to encode in tests. Regenerate the
gallery to inspect the actual collection.

## Content and behaviour

A design supplies structure, appearance and sample content. A Playbook supplies
purpose, words, display rules and setup guidance. **Keep my content** is the
editor default; **Use this design's sample content** can copy the examples into
a real draft. Sample words can therefore reach visitors and must be honest.

Every form has one primary conversion and a terminal acknowledgement. Say
what was captured, without claiming provider subscription, message delivery,
a confirmed appointment or an automatic restock notification. A shared code
may be displayed when a code node holds it; the merchant must create a valid
offer separately. Do not label a reveal action as an email delivery action.

Give fields visible labels and useful examples, with a country code for phone.
Ask for one contact method. Name and the supported `interest` choice default
to optional for enquiries. Explain how the business will use the details near
the form. Hidden consent wording must still match the contact method and ask.
Write privacy sentences that remain complete without a configured policy URL.

## Artwork and fonts

The original three-design phase used placeholders. The 28 September 2026
library programme supersedes that restriction: use a mix of complete text-led
designs and original or reusable licensed artwork, with provenance recorded.
Existing placeholder designs remain available. Fieldwork uses
a small CSS gradient in its editable media background. Do not disguise a
placeholder as a real photograph or manufacture a testimonial. Replacing it
with production artwork is a later visual review, not a blocker to this batch.

Keep offers, headings and buttons as editable text. Prefer reliable system
font stacks for these foundations; no remote font or image service is needed
to render them. A photograph added later needs a deliberate crop, fallback
surface and sufficient text contrast in both wide and narrow layouts.

## Authoring and review

Generate and read `out/VOCABULARY.md` before authoring. Designs are validated
JSON trees, not imported HTML. The vocabulary governs layouts, leaves, Slot
Roles and token names. Use stable leaf IDs. Scope token overrides to the
elements they affect, and limit `narrow` bags to values that actually retune.
Use a split's minimum column width (`basis`) to keep fields usable before
wrapping. Fieldwork and Callback notes use 16rem; the 24rem narrow appearance
breakpoint remains independent (ADR 0079).

Use the shipping renderer for all visual decisions. The new comparison page
is regenerated with:

```bash
./tools/design-library/build.sh renderer designs review
```

Open `out/flagships.html` through the existing local site's HTTP URL. Compare
the form and success states at 288px (the available width of a 320px popup),
320px, 390px, 768px and natural desktop width. Check longer text, visible
consent, missing imagery, RTL, Midnight and Minimal. The page's form submission
only demonstrates a screen transition; use WordPress to verify actual capture.

Also inspect the designs in the real WordPress picker and editor. Verify sample
application, content retention, element selection and edits, mobile previews,
success copy and the available phone/choice controls. Run the template validator,
PHP and JavaScript suites and source contract checks. Record failures and the
limits of visual review rather than calling structural validation visual approval.

## Editor controls now available

Split layouts have **Swap sides**, in one undoable edit, alongside Minimum column
width. Backgrounds and image leaves have **Picture focus**, with a separate mobile
override. Code blocks can expose an editable copy button with truthful outcome
messages. **Resource link** can open a configured file or page after a submission
without counting another conversion; incomplete links block publication.

The comparison includes pane swapping, picture focus and an optional resource-link
example. That example opens a local placeholder, never an invented customer asset.
See ADR 0080 for the rendering and counting boundaries.

## Later phases

Curate the twelve-design flagship collection next, then complete remote catalog
installation and compatibility handling. Installed designs must continue to work
locally without a live catalog connection. Movement between arbitrary containers
and the contrast helper’s handling of colour aliases remain editor follow-ups.

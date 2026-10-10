# 0136: One panel grammar

Date: 2026-10-10. Status: accepted.
Follows [0134](0134-one-edit-tab-look-screen-element.md) and
[0135](0135-plain-style-controls-exact-values-under-advanced.md). Amends 0134
(where the goal is shown), the goal-visibility chain of
[0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md),
[0085](0085-goals-have-publish-contracts-and-stable-history.md) and
[0087](0087-choices-first-details-on-demand.md),
[0131](0131-one-way-to-show-each-thing-in-the-admin.md) §8 and §9,
[0042](0042-the-admin-speaks-only-when-it-changes-what-you-do-next.md) §2,
[0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md) (field
labels) and [0078](0078-editor-choices-stay-compact-and-scrollable.md) (the
shadow control). GUIDELINES §4 and §6 carry the rules.

Reviewing the shipped editor (PRs #234–#237), the Look, screen and element
panels read as three products. An audit found eight section-title styles (h3,
two sizes of h4, an uppercase h5, h6, three kinds of `legend`, `strong`,
uppercase micro spans), four section wrappers with four spacings, three
label-to-control gaps (4, 5 and 6px), four checkbox patterns and seven ways to
show help. Long permanent paragraphs failed 0042's test, and the goal wrapped
under the name input in the header. A clickable before/after prototype was
approved first ([artifact](https://claude.ai/artifact/2fmkFrNcCSHGVLdwQq64wK)),
with one change: field hints one step smaller.

## Decisions

1. **Five pieces, in `builder/PanelSection.tsx`.** Every editor panel is
   written in them; a panel that needs something else adds it there, once.
   - `PanelHeader`: an optional "← Screen" back (named "Back to …"), the
     kind's icon (a headline is H, a field its channel; not "T" for all), the
     title, one muted caption, at most two icon actions.
   - `PanelSection`: a 14/600 sentence-case `h4` naming a region, an optional
     InfoTip and a link-style action in the title row. Sections are 16px apart
     and divided by one rule; fields inside are 12px apart.
   - `FactRow` (in a `FactList`): label, value, and the way to where it is
     changed. Then, Shown if, When it opens, When submitted and Where leads go
     are rows, with no cards and no banner.
   - `FieldHeading` / `PanelField`: the label (13/500) above, 6px, the
     control; the InfoTip beside the label; reset, link-sides and CSS actions
     at the end of the same row, for every field type. `PanelField` is the
     builder's dense form of `shell/Field`, not a second field: same order,
     same 6px, a 12px hint.
   - `PanelHint`: the one line a field may keep, `shell/Description` at
     12/400 muted. A `CheckRow`'s hint in a panel is the same 12px.
2. **Help has a ladder.** Delete a sentence the label already says.
   Otherwise keep one line of at most twelve words only if it changes what the
   merchant does next. Otherwise it is an InfoTip beside the label or section
   title. The InfoTip of 0131 now serves the builder as well as Analytics and
   Leads.
3. **Checkboxes are `CheckRow` with `.wconvert-check`**: 0131 §7's row. The
   `wconvert-setting-toggle`, `__check` and bare labels are gone from the
   panels and the insert dialog. Shown or hidden is the element header's eye,
   one name ("Show Headline") pressed while shown, not a checkbox;
   the screen panel's Consent disclosure, which has no header, keeps a
   "Shown" switch.
4. **Disclosures have titles of at most three words and say their value as
   the summary**: "How you'll use their details · Not set", "Consent ·
   Shown", "Products · 2 chosen", "Used by · 3 rules".
5. **Advanced sits at the panel's foot**, in the Look and the Style tab alike,
   never between groups. The Style tab's foot is one row: Reset, Copy, Paste,
   Advanced. Copy and paste were a disclosure.
6. **Values read in the body font.** A swatch says "Cream" in the panel's
   font; the hex, in mono, is Advanced's. The color popover offers the
   design's own colors first.
7. **The goal leaves the header.** The name box is as wide as the name
   (capped), and the status pill sits beside it. The goal is in Campaign
   details, with Change goal, and stays as the review dialog's meta line. Change
   goal is reached through ⋯, so focus returns to Campaign actions; it used to
   fall to `<body>`, because the dialog has no trigger of its own.
8. **Short text gets a short box.** Text boxes start at one row and grow with
   their lines (`AutoGrowTextarea`): a one-line headline sat in a four-row box.
9. **Per area**:
   - Tree: a one-line Look row ("Look · Fieldwork · Popup"), "Screens" in
     sentence case, screen rows 44px and element rows 32px, "counted" as a
     target icon whose name is the sentence, and Add element and Add screen as
     the same quiet + row. Element rows sit one 8px step in from their screen
     with a 16px twist slot, and "words will be lost" is a warning icon whose
     name is "What you type here is dropped when you switch design.": the chip
     and a 50px indent cut names to "H…".
   - Look: Ready-made looks, Colors (with "Use my theme's colors and font" as
     its action), Fonts (body and headings, each beside its size), Size and
     space, Picture, Effects, Format and position, Reopen button, Design. Gap
     and corner rounding are None · S · M · L buttons, not 72px selects that
     read "Cu". Shadows are drawn. The mobile note is gone.
   - Screen: facts first; the form as one compact list of fields; "Shown if"
     is a fact row with the rule as its summary and one line about the skip.
     Results show the rule on one line, and move and remove are one ⋯.
   - Element: the box it sits in is the caption ("In Colored box"); a button's
     caption says what it does ("Sends the form"); "Edit appearance ›" and
     "Show in Layers" are gone; a choice is one row with a ⋯ for Add
     follow-up, Review uses and Remove, and a follow-up it has is a tag under
     it; a linked phrase shows its address without a press on Link first.
   - Style: the element's own looks (Size) come first under their own labels;
     the device is one line ("Desktop · No mobile changes · Edit mobile"); a
     readability problem is one line with Fix.
   - Heading level, under Advanced, is labelled "Heading level" with an
     InfoTip ("For screen readers and search"); the manifest label lost its
     ", for screen readers and search".
   - Field types: the picture is its own control, and its address sits behind
     "Use a web address" (shown under Advanced, where there is no media
     library, or when the value is not a picture). A gradient's direction is a
     plain choice. The Google Font note is an InfoTip. "Set in CSS. Open
     Advanced to change it." is the one CSS-only wording. Link-sides has one
     name, pressed while linked.
   - Copy: "Up to 6. The first 3 available appear." in both product pickers.
     "Use the Increase basket value goal" stays a line under Add to cart: it
     changes which goal to pick.
   - Close leaves the Edit tab's screen panel, which always shows something.
     The legacy Manage screens dialog keeps it, because its inspector is the
     only thing that closes back to the map.

## Consequences

- "If skipped, go to…" is "If skipped, go to"; "Add matching result" is "Add
  result"; "Add answer path" is "Send some answers elsewhere"; "Show only if…"
  is "Shown if". The manifest's `field.required` label reads "Required" and
  `field.phone_dropdown` reads "Show a country list".
- The mobile and desktop reopen distances have distinct names; they were two
  inputs both called "Distance from edges (px)" on one panel.
- `admin-stylesheet.test.ts` still requires a rule for every class the builder
  renders, so classes that only named a section went.
- A popup has no position to choose, so its Look shows the format fact alone;
  the prototype's Position select for a popup does not exist.

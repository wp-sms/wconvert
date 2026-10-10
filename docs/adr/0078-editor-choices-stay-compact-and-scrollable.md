# Editor choices stay compact and scrollable

This refines [ADR 0077](0077-editor-controls-make-placement-and-formatting-explicit.md) after live use exposed submenu clipping and overly large supporting controls.

## Menu boundaries

Every shared dropdown submenu is portaled, bounded to the available viewport height, and vertically scrollable. The overflow is stated with the same Tailwind utilities as the component: a normal CSS override cannot beat this project's important utility declarations. Layer-specific menus cap their height at 440px and use 13px actions with 12px explanatory text. The tree uses the same 13px reading size.

Portaled React keyboard events still bubble through the layer tree. The tree handles keys only when the event target is physically within its DOM; Home, End and arrows in a menu therefore remain menu navigation. The regression test exercises the actual insertion submenu.

## Style controls

Numeric controls show amount and unit, and unit menus contain only units. *Amended by [ADR 0135](0135-plain-style-controls-exact-values-under-advanced.md): the unit is a word beside the amount in the plain view; the unit menu, shadow geometry and the CSS icons are Advanced's.* Stored CSS expressions still receive a text editor; ordinary measurements no longer offer a Custom unit. Padding uses compact link and CSS icons beside its label, with separate sides arranged in two columns when space permits. Shadow uses a named preset select, an optional geometry disclosure, and a small CSS icon; unparseable authored shadows remain editable. Named layered-shadow presets keep their CSS behind the edit icon; unrecognised custom shadows still show their authored value. Opening an adjustment writes nothing.

This completes the progressive disclosure rule in [ADR 0054](0054-every-control-has-the-shape-of-its-value.md) and refines the measurement controls in [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md). It does not remove authored values, reset controls or inheritance.

### Visual choices and field arrangement

Alignment and panel borders use compact icon rows with accessible names and hover titles. Alignment's Custom CSS icon sits in the same row. Image fit, shape and column proportions retain previews because their meaning is visual. Textual choices, including heading weight, letter spacing, line spacing, animation and minimum height, use native selects. Boolean settings use checkboxes. An off-list parameter remains visible as the current value until a preset is chosen, without coercing or replacing stored data.

Local overrides no longer print a bare “Custom” status below every field: the displayed value and reset action already communicate that state. Inheritance links, palette-follow actions and mobile override notices remain.

The manifest groups body text, headings, pictures and effects separately and supplies field order within each section. Picture controls lead picture scopes, typography leads text scopes, and spacing leads layout scopes. Button and form-field colors lead their scopes. This order depends on the element type, never a background value being edited, so replacing a picture cannot reorder the inspector. Gap and corner rounding share a row when at least 268px is available; other controls keep their full width. Numeric resets sit beside field labels, so changing a value does not squeeze its number and unit inputs. Image fit, shape and other element settings are visible at the top of Style, without an extra disclosure. Copy/paste styles follows the settings; mobile inheritance details use a compact disclosure with a visible override count.

Picture focus appears only when the current scope or a descendant has a picture. The decision follows desktop/mobile background overrides and the renderer's panel/media background reset. The global control also considers pictures used only on mobile. Gradient-only and empty backgrounds do not need focus; custom CSS image expressions remain editable. Empty image elements keep their source control but hide fit and shape until a source is present. Hiding controls never clears their stored values.

Relative heading/text presets say Heading scale and Text scale to distinguish them from the numeric font size. Labels use short familiar terms: Minimum height, Gap, Picture fit, Required field and Badge position. This changes wording only, not the manifest keys or saved values.

### Keeping your place

Style numbers, custom choice values and picture addresses commit on Enter or blur, and Escape cancels unfinished text. Enter keeps focus in the input and a later blur does not commit twice. Custom choice editors stay mounted even when the value being typed matches a preset. Picture previews keep the existing image until its replacement address is committed.

Ordinary edits and desktop/mobile preview changes keep the inspector scroller. Selecting another element resets it to the primary controls, closes the previous element's picker and resets local style-editing modes. The selected Content/Style tab remains useful across elements.

## Adding rules

The Add rule control opens a searchable, viewport-bounded popover. Type labels, preset labels and phrases are searchable together; Time delay makes “delay” discoverable. A preset or the general form is still one selection. Pro-only and missing-dependency types remain searchable, noninteractive text grouped under their distinct explanations, refining the menu presentation in [ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md).

Search receives focus on opening. Arrow keys move between results, Home/End reach the ends, and Escape closes and returns focus to Add. Opening, searching and closing write nothing. Content follows the document's RTL direction, uses logical spacing, wraps long labels and scrolls independently below the search field.

## Starting points

The Display rules panel has a short introduction and Browse starting points button. One dialog holds search, a responsive card grid and a before/after review step. Choosing a card changes only the dialog; Replace these rules writes the selected sections as one undoable draft edit and closes the dialog. Back to choices restores the card's focus; closing returns to Browse starting points.

Availability explanations remain visible. No new saved selection exists: a Starting point is a patch to rules, not a persistent mode or a new source of truth.

## Text formatting

Text and consent add a plain-string italic field, filled at %i and rendered with a semantic em element. It follows the existing bold/link model: one phrase per kind, no nested formatting, and no HTML interpretation. Repeated authored placeholders retain the explicit-field editor. Clear formatting removes the selected phrase's marks, or all marks without a selection, while preserving words. Command/Control+B, I and K invoke the toolbar actions.

The template manifest declares italic for both content and copying, so normalization and template switching retain it. The renderer and Consent Record compose the same sentence. Both remove empty marks before expanding each kind once; replacement words are never parsed again. Shared fixtures cover missing/repeated italic, literal HTML and a link label containing another placeholder.

No table or column changes are involved. No editor dependency is added. A future editor with multiple ranges or overlapping bold/italic/link needs a structured run model; it should not add more placeholder workarounds. Library research and the recommended scope are recorded in [the follow-up audit](../reviews/editor-followup-2026-09-11.md).

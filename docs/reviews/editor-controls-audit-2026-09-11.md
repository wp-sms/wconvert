# Editor controls and layers audit — 11 September 2026

The layer foundation is worth keeping. It already has structural guards, direct selection, keyboard navigation, sibling dragging, duplication and draft Undo. The weaknesses were discoverability, placement clarity and the control surfaces carried over from the earlier editor. This pass improves those surfaces without turning the Optin editor into a page builder.

> Current follow-up: [compact menus, Starting points and italic](editor-followup-2026-09-11.md) refines the initial implementation below.

## Findings and changes

| Area | Finding | Result |
| --- | --- | --- |
| Fit / 100% | A 25px select inherited a 34px line height. | Explicit matching height and line height; verified in the live browser. |
| Scrolling below editor | 65px reserved for the hidden WordPress footer, plus absolutely positioned accessibility controls escaping the inspector's clipping. | Footer padding removed for editing only; positioned workspace and pane bodies contain the controls. Document and viewport matched at 1512 × 862 and 1280 × 800; the latter also passed with Layers open at Fit 81%. |
| Color picker | `.wconvert-picker` also styled the large template dialog, forcing the color control to 86vh. Automatic width grew around help copy. Opaque hex values offered no opacity control. | Separate namespace, bounded popover, consistently available alpha control, inherited value shown, hex-alpha and common RGB notation supported. Custom CSS remains editable without conversion. |
| Terminology | Merchant-facing labels mixed color and colour. | Color, colors and colored labels consistently used in the editor and template labels. |
| Add elements | Only after/inside actions, hidden in row menus. A generic Field silently selected the next unused kind. | Visible searchable picker, explicit placement before/after/beginning/end, and direct capture-kind selection with duplicate reasons. |
| Collapsed containers | Adding inside or selecting from the preview could leave the selected child hidden. | Reveal the child's ancestors; preview selection does not steal keyboard focus. |
| Duplicate feedback | A warning claimed an unroled copy could not be selected in the preview; preview selection now uses paths. | Plain confirmation; existing role stripping and guards remain. |
| Shadows | Presets were words; custom shadows required CSS, including most authored tinted/upward shadows. | Visual samples, numeric geometry, color/opacity and inner shadow. Complex CSS remains intact. |
| Fonts | Existing site-font support was difficult to discover; large lists were unsearchable. | Search, site/system grouping, local Google Font workflow and Font Library link. |
| Starting points | Long section badges competed with titles. | Separate icon, title, section metadata, description and review action; responsive cards. |
| Optin details | Goal, stats and a long undo explanation had little hierarchy. | Named Optin, status, goal, performance and a collapsed history explanation. |
| Text editing | Users had to coordinate `%b`, `%s`, bold words and link fields manually. | Small selection toolbar, plain sentence entry, formatted preview and atomic history updates. |

## Layer capabilities and boundaries

- Both screens have an insertion target, including empty containers and both panes of a split.
- Before/after reflects document order; for a horizontal row those positions render beside each other. They are deliberately not called above/below everywhere.
- Fields are offered by capture kind. A kind already on the form remains visible with its reason. Capture restrictions are checked again when constructing the node.
- The converting button and the final capture field remain protected. Duplicating a containing layout cannot bypass those restrictions.
- Arrow keys, Home/End, row action buttons and Alt+Up/Down remain the keyboard routes. Dragging is an additional sibling reorder route.
- Selection, insertion, deletion, duplication and ordering continue to use the existing tree and whole-draft history. No new stored identifiers or layout model were added.

The largest remaining capability gap is moving an existing element between containers. That should be a deliberate **Move to…** target picker first, then a matching drag destination. It needs cycle prevention, destination validation, empty-container targets, focus restoration and an undoable transaction. Arbitrary nested dragging without those rules would make the editor less predictable.

Other worthwhile follow-ups are multi-selection for repetitive actions, a compact layer-search mode for very large templates, and visual per-device visibility indicators. These are additional features, not required to repair insertion and the current controls.

## Other field controls

| Control | Audit and direction |
| --- | --- |
| Length, spacing and size | Keep the existing numeric amount + explicit unit + slider where its scale fits. Custom expressions remain an escape. Three/four-value spacing could later gain a linked-sides control. |
| Choice controls | Keep small sets as labeled choices and longer lists searchable. Shadow samples now make their effect visible before selection. |
| Images and backgrounds | Keep the existing media-library route and current asset feedback. A focal-point control would help image-heavy layouts, but needs an explicit renderer parameter. |
| Icons | Existing visual glyph choices are suitable for the small vocabulary. Add search/categories only if that vocabulary grows. |
| Capture fields | Choose Email, Name, Phone number or Interest explicitly at insertion. Labels, required state and interest options remain in the selected field inspector. |
| Countdown | Keep its deadline linked to the Optin schedule, with the existing route to that setting; adding a second deadline would create conflicting sources. |
| Inheritance and phone overrides | Preserve reset-to-inherited behavior and the existing phone scope. A clearer summary of which values are overridden is a useful follow-up. |

## Google Fonts

WConvert already reads the fonts WordPress declares and prints the site's font faces in wp-admin. WordPress's Font Library can install Google Fonts and serve the files locally. The picker now points to that workflow and filters its existing families by name. No API key or WConvert font catalogue is needed.

On WordPress 7+, the link opens Appearance → Fonts. On 6.5–6.x with a block theme it opens the Site Editor's styles area. Older or unsupported installations receive instructions. The link is only supplied when the user has `edit_theme_options`. Save the draft and reload the editor after installing a font so the admin's font-face declarations refresh. A font family string alone cannot download a font.

Sources: [WordPress Font Library](https://wordpress.org/documentation/article/the-font-library/), [WordPress font-face generation](https://developer.wordpress.org/reference/classes/wp_font_face/).

## Small editor options

| Option | Fit for this product |
| --- | --- |
| Selection toolbar over the existing sentence | Implemented. Small, predictable, no new renderer format; supports the one bold phrase and one link already declared. |
| Inline WYSIWYG using a rich-text engine | A possible next step if multiple independent links/emphasis ranges, italic or lists are needed. Requires a structured run model, renderer/normalizer changes and paste/history handling. |
| Full document editor | Too broad for short Optin copy and the existing constrained template model. |

The implemented editor is a textarea plus a formatting preview, not direct canvas typing. It intentionally makes the present capabilities easier to use. Repeated legacy placeholders retain their explicit fields to avoid loss of structure. Headings use their own text and typography controls.

## Verification

Local WordPress 7.1 with the Pro admin bundle was used for visual and interaction checks. The checked draft was returned to its original saved content after temporary edits. No Optin was published and no font was installed during verification.

Checks include color-popover bounds, alpha changes and Undo, shadow geometry changes and Undo, shadow-popover dismissal on tab change, zoom line height, document overflow, exact field insertion and Undo, selected-word bold and Undo, Font Library discoverability, details layout, starting-point cards, and desktop/mobile preview layouts. Automated checks cover sentence conversion, literal markup handling, atomic formatting, color alpha conversion, complex shadow preservation, before-insertion, capture choice, duplicate refusal, and existing structure/history behavior.

The final JavaScript run passed all 2,275 tests across 93 files. All 1,839 PHP tests passed (8,229 assertions), along with TypeScript, ESLint, PHPStan, both admin builds and the loader/source contracts. CI provides the final branch-wide checks.

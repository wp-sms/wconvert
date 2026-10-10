# Editor controls make placement and formatting explicit

This extends [ADR 0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md), [ADR 0054](0054-every-control-has-the-shape-of-its-value.md), and the site-font workflow in [ADR 0055](0055-the-font-list-is-the-sites.md). It adds no database storage or visitor-facing rendering vocabulary. The follow-up in [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md) adds the structured italic phrase.

## Placement

Layers has a searchable Add element picker. *(Since [ADR 0134](0134-one-edit-tab-look-screen-element.md) there is no Layers pane: the picker is the open screen's "Add element" in the Edit tree, with the same position control.)* Its position control names the selected element and offers before/after, or the beginning/end of each child collection. With no element selected, it uses the current screen's root. The row menu also offers before/after and inside insertion.

Field creation offers the capture kinds from the manifest explicitly. Already-used kinds are explained and disabled; `nodeFor` independently refuses an invalid or occupied requested capture. Existing guards still protect the sole converting button, the final capture field, form-step restrictions, and unique captures. Reordering remains among siblings with pointer and keyboard routes. Adding or selecting a descendant reveals collapsed ancestors without moving focus away from a preview selection.

## Appearance

Color pickers use their own CSS namespace, bounded portal size, and an alpha-capable picker. They display inherited values without creating overrides and preserve custom CSS text. Short/long hex alpha and comma/space RGB syntax are converted only for the visual control; opening a picker never rewrites a token. Opacity is now an explicit choice for every color; translucent foreground/background pairs continue to report no contrast reading rather than claiming a pass. Shadow-color popovers share the panel’s controlled open state so switching tabs closes them too.

The manifest declares the shadow control alongside the image control. Shadow presets use a compact named select, as refined by [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md). A single pixel shadow exposes horizontal/vertical offset, blur, spread, color and inset. Other units, layered shadows and expressions stay verbatim behind Custom CSS. Opening controls never renormalizes a shipped shadow.

> Refined by [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md): repeated CSS disclosures are removed; custom entry is an explicit choice. All submenu levels are portaled and scrollable.

The editor owns its viewport. Hidden accessibility controls use containing blocks within the scroll panes; they cannot extend the outer document. Zoom controls define both their height and line height. Footer spacing is removed only while editing.

## Text

> Extended by [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md): italic and Clear formatting join the toolbar; text and consent add an italic string at %i, with matching renderer and consent-record behavior.

Text and consent elements get a selection toolbar for the existing bold phrase and link. A textarea contains the words, and a readout shows the formatting. One formatting action updates text, emphasis and link atomically, as one draft-history entry. Typing preserves marks outside the edited range and those edited internally; crossing a mark boundary removes that mark.

The stored model is still `text` with `%b`/`%s`, `emphasis`, and `link`. No HTML is accepted as formatting and no rich-text document engine is introduced. A sentence with repeated placeholders retains the existing explicit fields rather than being silently rewritten by a one-phrase editor. Headings retain their existing content input and typography controls.

## Site fonts and supporting panels

The font list becomes searchable and names both site and system fonts. The theme response provides a Font Library URL only for users who can edit theme options, with a version/theme-aware route and documentation fallback. Google Fonts are installed through WordPress and hosted by WordPress. Saving and reloading the editor refreshes font-face declarations; WConvert still loads no remote font stylesheet.

Starting points retain their before/after confirmation and draft Undo semantics, with an icon, readable title, affected-section metadata and explicit review affordance. Optin details groups publication/draft status, goal and performance; draft-history explanation moves into a disclosure. Developer tools remain developer-only.

> Refined by [ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md): Starting points now opens a searchable chooser and review step in one dialog, leaving a compact button in Display rules.

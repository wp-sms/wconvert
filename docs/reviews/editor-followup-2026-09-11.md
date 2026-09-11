# Editor follow-up — 11 September 2026

## Delivered

- Tall Layers submenus scroll, including nested menus. Home/End and arrow keys stay in the menu. The final Picture box option was reached, selected and undone in local WordPress.
- Layer names and menu actions use 13px text; menu explanations use the existing 12px scale role.
- Repeated Custom CSS value rows are removed. Custom entry remains inside the unit choice or the shadow's explicit Custom option, and existing CSS expressions remain editable.
- Starting points moved into a searchable chooser dialog with a separate review step in the same dialog. Applying is still one undoable edit; the main Display rules panel stays compact.
- Text and consent support Italic and Clear formatting alongside Bold and Link, with Command/Control+B, I and K. The simple model supports one separate phrase per format. Headings retain their text and typography controls.

## Font Library ownership

/wp-admin/font-library.php belongs to WordPress, not WConvert. On WordPress 7+, Appearance → Fonts supports both classic and block themes. Google Fonts installed there are downloaded and served from the site. WConvert reads the site's fonts and links to this screen; it does not install its own font manager. [WordPress Font Library documentation](https://wordpress.org/documentation/article/the-font-library/)

## What short Optin copy needs

Bold helps emphasize an offer; italic is useful for short qualifications and quoted wording; links need clear labels; clearing formatting makes edits reversible without retyping. Those four controls are enough for the current sentence model.

I would avoid adding underline, arbitrary text colors, headings, images or tables to this toolbar. Underline competes with link styling, colors and typography already belong to Style, and structural content belongs to Layers. Multiple links, independently formatted ranges or combined bold+italic would justify a richer editor and a structured text-run format.

## Library comparison

These are architectural assessments, not bundle benchmarks. Published core sizes do not include a complete React editor.

| Option | Assessment for WConvert |
| --- | --- |
| Existing textarea and selection toolbar | Used in this pass. No dependency and no competing editor history. The limitation is explicit: one non-overlapping phrase per format. |
| Lexical | Preferred candidate if multi-range WYSIWYG becomes a requirement. Its modular core, React integration and serializable editor state fit a controlled editor. The documentation reports a 22 KB min+gzip core; React bindings and selected features add to that. [Official introduction](https://lexical.dev/docs/intro) |
| Tiptap | A capable alternative with a headless UI and selected ProseMirror-based extensions. Well suited to a broader content editor; adopting it here would require measured bundles and a richer serialization contract. [Official overview](https://tiptap.dev/docs/editor/getting-started/overview) |
| WordPress RichText | Appropriate inside the block editor. WordPress's own reference says the component belongs there rather than other admin areas, so it is not a drop-in choice for this standalone React screen. [Official reference](https://developer.wordpress.org/block-editor/reference-guides/richtext/) |
| Pell | Its small advertised footprint is attractive, but it produces HTML and relies on document.execCommand. That API is deprecated, making it a weak foundation for expanding a maintained product editor. [Project source](https://github.com/jaredreich/pell), [API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand) |

## Verification

The submenu failure was reproduced in the live WordPress editor: 858px of content in a 438px box, with scrolling suppressed by an important overflow-hidden utility. After the fix the final item stays visible at the viewport edge, scrollTop reaches 420px, and selecting it works.

Browser checks also cover the compact Starting points entry, two-column dialog, search, review/apply/Undo, italic in the canvas and text preview, Clear formatting/Undo, and the simplified Style tab. Testing used a separate tab because the user's original tab held unsaved work. Only temporary QA edits were undone; the original tab was not reloaded or saved.

Final checks passed: 2,291 JavaScript tests across 93 files; 1,844 PHP tests (8,234 assertions); TypeScript; ESLint; PHPStan; both admin builds; and source/loader contracts. The submenu and chooser were also checked in a 1280 × 600 viewport. Shared PHP/JavaScript consent fixtures verify that formatted wording agrees across the renderer and capture record. Loader budgets remain unchanged.

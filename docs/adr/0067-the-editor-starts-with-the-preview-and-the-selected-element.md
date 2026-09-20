# The editor starts with the preview and the selected element

The primary user is a merchant adapting a ready-made Template. The user approved
the Fieldwork prototype after comparing the existing WordPress editor with the
reference editor. The production editor adopts that flow.

> **Amended by [ADR 0085](0085-goals-have-publish-contracts-and-stable-history.md):** Goal and precise metric now stay visible below the editor header. Change goal is for unpublished drafts; published Optins offer duplication.

## Workspace

The builder owns its viewport, while the other admin screens retain Shell.
The header holds the name, Design / Display rules / Destinations, Undo draft edit / Redo draft edit,
Preview, Save draft, Review & publish and Optin details. Draft/publication status
stays visible in the footer at every supported editor width. WordPress navigation stays
visible by default; Full width remains optional and remembered per browser.

Design opens with a large canvas and design settings. Layers is optional and
shows the current screen's tree, including its existing move, copy, delete and
keyboard controls. Form and success screens and desktop/mobile widths have
explicit controls. Fit scales the canvas visually without changing the template
width or triggering a different responsive layout.

**Extended by [ADR 0101](0101-reopen-buttons-preserve-an-explicit-visitor-choice.md):** enabled Pro popup and slide-in Campaigns add a Reopen button screen beside the form and success controls. It shares the canvas, zoom, and Desktop/Mobile controls; its settings panel contains authoring controls and on-demand help.

A click selects the deepest element under the pointer. Repeated clicks keep it
selected. Breadcrumbs expose its ancestors, and Design settings returns to the
whole design. A leaf has Content and Style; a container offers its appearance
and arrangement controls directly. Image controls show the current image and a
visible replacement action using WordPress's media library.

**Extended by [ADR 0072](0072-setup-choices-state-their-effect-and-scope.md):**
creation hands off here directly after Goal and starting-point choices. The
explicit customization action creates a draft; a separate repeated-preview
confirmation no longer precedes this editor. Under [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md), Undo restores the name and complete
draft configuration. Goal correction explains that it saves the current name
and all draft edits without publishing, and starts a new local Undo history.

The form preview accepts local input and advances to the success screen without
sending a capture or following a destination link. The canvas is an editing and
form-testing surface, not a simulation of the site's actual page placement.
Readiness opens through **Review & publish** in the header, with actions back to
the relevant editor section. This replaces the former footer Summary under
[ADR 0070](0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md).
Goal and performance move to Optin details; payload/export tools remain
developer-only. The technical check strip is no longer permanent merchant-facing
chrome.

> Extended by [ADR 0077](0077-editor-controls-make-placement-and-formatting-explicit.md): Layers gets explicit placement and capture-kind choices; color and shadow controls are bounded and visual; a small selection toolbar edits existing sentence formatting atomically.

## Appearance remains a closed vocabulary

Every leaf may carry `tokens` and `narrow`, using the same normalizer and existing
token names as layouts. This lets a selected heading or button be restyled
without wrapping it in a container. No arbitrary CSS property or position is added.

The manifest declares `style_tokens` for each node, named `token_groups`, and
`token_controls` for the background image picker. An overlay gradient stays a
style value rather than being mistaken for an image address.
The inspector shows the selected node's readers; a layout also includes readers
used by descendants. Global design settings still offer the full vocabulary. [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md) adds
amount/unit inputs and local-draft CSS/colour text entry by existing value kind,
without changing token names, inheritance or validation semantics.
Typography is reapplied at styled elements so inherited computed CSS does not
prevent a local font or text-size token from taking effect.

> Extended by [ADR 0084](0084-picture-transfer-and-friendly-style-controls.md): overlays and background layers now offer visual linear-gradient controls; unsupported syntax stays editable as CSS.

Mobile means the 22rem preview inside the existing 24rem container breakpoint.
A mobile override wins over the same element's desktop value; clearing it reveals
that desktop value, then the nearest ancestor. The renderer threads ancestor
mobile overrides when materializing a child's narrow bag. Overriding a child's
size therefore does not reset its parent's mobile color or font.
Global design settings apply to all sizes and say so in mobile view. Fonts remain
site-provided under ADR 0055; the prototype's bundled reference fonts do not ship.
Mobile editing also keeps a visible reminder that text and blocks are shared
across sizes, including before any node is selected (ADR 0072).

## Template selection is draft work

`POST /templates/snapshot` prepares a normalized template with the existing Slot
Role and merchant-owned asset carrying rules. It requires the manage capability
and writes nothing. The editor records the returned template and its template id
in one history entry. Undo restores both and uses the saved baseline to determine
whether any unsaved work remains.

Save sends `template_source` as request metadata, matching the prepared template
id. That avoids resnapshotting over edits made after selection. Vocabulary,
trigger, goal, conversion, destination and payload checks still apply on Save.
The metadata is not persisted. No database schema or storage is added.

The picker defaults to Keep my content and offers Use this design's sample
content under [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md). It previews the exact normalized candidate before
Apply. Carrying can leave content empty, moved or hidden; sample mode replaces
words, images, links and form settings. Both remain one draft Undo entry. Publishing remains separate from Save draft,
but no longer requires returning to the list: **Review & publish** offers an
explicit promotion in the editor. A dirty draft is saved first and is promoted
only if that save succeeds. The list also offers **Publish changes** when saved
configuration differs from the published snapshot. See [ADR 0070](0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md).

## Validation

Tests cover direct selection, contextual controls, leaf token normalization,
nested mobile inheritance, draft-only template changes, Undo/Redo, prepared
snapshot saving and the existing structure and publishing guards. The real
WordPress pass uses a dedicated draft, including saved-state reload, media
replacement, desktop/mobile styling and form preview. The loader budget remains
enforced for every tier.

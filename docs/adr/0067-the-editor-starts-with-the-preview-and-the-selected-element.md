# The editor starts with the preview and the selected element

The primary user is a merchant adapting a ready-made Template. The user approved
the Fieldwork prototype after comparing the existing WordPress editor with the
reference editor. The production editor adopts that flow.

## Workspace

The builder owns its viewport, while the other admin screens retain Shell.
The header holds the name, Design / Display rules / Destinations, draft status,
Undo / Redo, Preview, Save draft and Optin details. WordPress navigation stays
visible by default; Full width remains optional and remembered per browser.

Design opens with a large canvas and design settings. Layers is optional and
shows the current screen's tree, including its existing move, copy, delete and
keyboard controls. Form and success screens and desktop/mobile widths have
explicit controls. Fit scales the canvas visually without changing the template
width or triggering a different responsive layout.

A click selects the deepest element under the pointer. Repeated clicks keep it
selected. Breadcrumbs expose its ancestors, and Design settings returns to the
whole design. A leaf has Content and Style; a container offers its appearance
and arrangement controls directly. Image controls show the current image and a
visible replacement action using WordPress's media library.

The form preview accepts local input and advances to the success screen without
sending a capture or following a destination link. The canvas is an editing and
form-testing surface, not a simulation of the site's actual page placement.
Readiness stays available in the footer. Goal and performance move to Optin
details; payload/export tools remain developer-only. The technical check strip
is no longer permanent merchant-facing chrome.

## Appearance remains a closed vocabulary

Every leaf may carry `tokens` and `narrow`, using the same normalizer and existing
token names as layouts. This lets a selected heading or button be restyled
without wrapping it in a container. No arbitrary CSS property or position is added.

The manifest declares `style_tokens` for each node, named `token_groups`, and
`token_controls` for the background image picker. An overlay gradient stays a
style value rather than being mistaken for an image address.
The inspector shows the selected node's readers; a layout also includes readers
used by descendants. Global design settings still offer the full vocabulary.
Typography is reapplied at styled elements so inherited computed CSS does not
prevent a local font or text-size token from taking effect.

Mobile means the 22rem preview inside the existing 24rem container breakpoint.
A mobile override wins over the same element's desktop value; clearing it reveals
that desktop value, then the nearest ancestor. The renderer threads ancestor
mobile overrides when materializing a child's narrow bag. Overriding a child's
size therefore does not reset its parent's mobile color or font.
Global design settings apply to all sizes and say so in mobile view. Fonts remain
site-provided under ADR 0055; the prototype's bundled reference fonts do not ship.

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

The picker warns that content may be empty, moved or hidden and asks the merchant
to inspect both screens. Choosing between sample content and carried content is
deferred, as the user requested. Publishing remains a separate action on the list.

## Validation

Tests cover direct selection, contextual controls, leaf token normalization,
nested mobile inheritance, draft-only template changes, Undo/Redo, prepared
snapshot saving and the existing structure and publishing guards. The real
WordPress pass uses a dedicated draft, including saved-state reload, media
replacement, desktop/mobile styling and form preview. The loader budget remains
enforced for every tier.

# Draft history and template content choices stay predictable

The editor serves a merchant adapting a ready-made Template. They may change a
name, adjust display rules, select destinations and replace a design in the same
session. An Undo control beside Save draft should recover those draft edits.
Similarly, a replacement preview should show the content that Apply will use,
not samples that disappear after the merchant chooses the design.

The user authorized the previously deferred content choice and the remaining
editor improvements. This extends [0067](0067-the-editor-starts-with-the-preview-and-the-selected-element.md),
[0069](0069-the-library-helps-merchants-compare-before-applying.md) and
[0072](0072-setup-choices-state-their-effect-and-scope.md) without introducing a
new persisted document format.

## Undo covers the working draft

Header controls say **Undo draft edit** and **Redo draft edit**. Each history
snapshot contains the current name and complete draft configuration: design tree
and tokens, template id, rules, targeting, schedule, frequency, priority and
selected destination ids. Restoring replaces the configuration rather than
merging it, so Undo also removes a newly added setting. A starting-point rule
replacement and a template replacement are each one atomic history entry.

History remains local to this editor session, bounded at 50 entries, with the
existing 900ms coalescing window for named typing controls. Typing the name now
uses that window. Selection, open panels, preview screen and viewport are not
persisted draft content and are not history entries. Structure selection still
recovers a surviving path after a tree replacement. Text inputs retain native
Undo; the global shortcut does not intercept text editing or dialogs.

Ordinary Save accepts the normalized server response as the current snapshot;
it does not create an extra Undo entry or erase older entries. Undo across a
save changes the working draft and recalculates dirty state against the saved
baseline. Save and Publish remain explicit writes. Undo after publication does
not restore `published_config`, unpublish an Optin or send anything externally.

Selected destination ids belong to this draft. The shared destination's settings,
connections and delivery actions do not. Editing a shared destination remains an
independent explicit save under [0070](0070-drafts-are-reviewed-and-explicitly-published-from-the-editor.md).
Optin details describes those boundaries rather than implying that Undo reverses
site-wide settings or published visitor behavior.

## Saving a new Goal starts a new history

Goal correction still saves immediately: **Save draft and change goal** saves the
name and complete current configuration alongside the Goal column. It restates
existing reporting under that Goal and does not publish. The confirmation now
also says that successful completion clears local Undo and Redo history.

This is a deliberate boundary, not an implicit Goal-save operation attached to
Undo. A failed save preserves both the current Goal and the local history. After
a successful correction, subsequent draft edits are undoable back to that saved
state. Changing the Goal again remains available through the same explicit
confirmation. No server-side history, Goal-only draft column or automatic write
is introduced.

## Choose content before applying a design

Inspecting an installed design defaults to **Keep my content**. The alternative
is **Use this design's sample content**. Both choices prepare the actual
normalized candidate through the existing read-only `POST /templates/snapshot`
endpoint before Apply becomes available.

- Keep passes the current template and its source id. Existing Slot Role and
  merchant-owned asset carrying rules fit content into the selected layout;
  content without a matching place can move, disappear or leave empty slots.
- Sample passes the selected design's sample tree and tokens with that same
  design id as the source. The existing same-source path returns its normalized
  content without carrying the old draft into it. Sample words, images, links
  and form settings replace the old content; offers and links still need review.
- The renderer shows the returned candidate, including every actual screen and
  desktop/mobile layout. Apply receives that exact object and its design id;
  it does not perform a second preparation after the preview. Save continues to
  send the existing `template_source` request metadata to preserve later edits.
- The current design can be explicitly reset to its samples. Keeping its current
  content remains a no-op and has no Apply action.

Mode changes immediately hide the previous candidate until the new result is
ready. Obsolete responses cannot replace a newer choice. Preparation failure
stays in the detail view with Retry; it does not close the picker, mutate the
draft or discard the selected mode. Back and Close remain available during this
read. Closing stops preparation effects, including during the dialog's exit
animation. Browse query, filters, scroll position and focus restoration remain.

Compatibility refusals, availability and converting-act warnings still apply.
Sample content cannot waive a Goal, destination or A/B compatibility guard. The
preview stays inert: inspecting or applying a design creates no Capture and
follows no provider or visitor link. No migration rewrites saved Optins.

## Appearance inputs respect the existing value kind

The closed token vocabulary and inheritance rules remain. Existing enum/font
choices, colour palettes, preset chips and design-based sliders remain useful.
Parseable one- and two-value lengths additionally get named amount and unit
inputs, plus a **Custom CSS** escape hatch. Selecting another unit keeps the
number; it never guesses a conversion between `rem`, `px`, percentages or other
units. Slider availability still follows its design range and unit rules, while
amount/unit inputs can express values outside that range.

Custom CSS remains available for values such as `clamp(...)`, three-/four-part
padding and other unparsed expressions. Colour text accepts named colours,
`rgb(...)`, variables and other CSS strings without a hex-only input filtering
characters. Incomplete number/CSS text stays local until Enter or leaving the
control applies it, so intermediate typing does not destroy the control or its
focus. The hint names that behavior. Escape cancels unapplied text; in a colour
popover the first Escape keeps focus and cancels text, and the next can close it.

Opening a control or switching to Custom CSS writes nothing. Clearing continues
to mean deleting an override, distinct from explicit `0` or `none`. Design reset,
ancestor inheritance and nested mobile overrides retain their existing meaning.
A change in appearance never creates mobile-only text or blocks. This adds no
CSS validation guarantee: the browser still interprets values under the closed
property vocabulary described in [0054](0054-every-control-has-the-shape-of-its-value.md).

## Verification boundary

Focused interaction tests cover mixed name/rule/destination history, normalization
on Save, publication separation, successful/refused Goal history boundaries,
exact Keep/Sample preparation and apply, obsolete response rejection, retry and
Back. Existing structure, gallery and navigation contracts remain under test.
Appearance tests cover amount/unit editing, custom CSS, colour focus, reset and
mobile inheritance. Final integrated checks and real WordPress verification are
recorded by the parent task in the flow-by-flow review; this decision does not
claim a provider send, live publication or completed CI run.

## Follow-up

[ADR 0078](0078-editor-choices-stay-compact-and-scrollable.md) moves measurement CSS entry into an explicit Custom… unit choice and shadow CSS into its Custom choice, removing the repeated disclosure rows while keeping authored values editable.

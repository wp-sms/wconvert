# Editor choices stay compact and scrollable

This refines [ADR 0077](0077-editor-controls-make-placement-and-formatting-explicit.md) after live use exposed submenu clipping and overly large supporting controls.

## Menu boundaries

Every shared dropdown submenu is portaled, bounded to the available viewport height, and vertically scrollable. The overflow is stated with the same Tailwind utilities as the component: a normal CSS override cannot beat this project's important utility declarations. Layer-specific menus cap their height at 440px and use 13px actions with 12px explanatory text. The tree uses the same 13px reading size.

Portaled React keyboard events still bubble through the layer tree. The tree handles keys only when the event target is physically within its DOM; Home, End and arrows in a menu therefore remain menu navigation. The regression test exercises the actual insertion submenu.

## Style controls

The repeated Custom CSS value disclosures are removed. Numeric controls keep amount and unit as their ordinary form; choosing Custom… in the unit selector opens text entry, with a route back to numbers. A stored expression still gets an editable value. Shadow geometry stays visual; raw CSS appears only when the shadow cannot be decomposed or Custom is explicitly chosen. Opening either route writes nothing.

This completes the progressive disclosure rule in [ADR 0054](0054-every-control-has-the-shape-of-its-value.md) and refines the measurement controls in [ADR 0075](0075-draft-history-and-template-content-choices-stay-predictable.md). It does not remove authored values, reset controls or inheritance.

## Starting points

The Display rules panel has a short introduction and Browse starting points button. One dialog holds search, a responsive card grid and a before/after review step. Choosing a card changes only the dialog; Replace these rules writes the selected sections as one undoable draft edit and closes the dialog. Back to choices restores the card's focus; closing returns to Browse starting points.

Availability explanations remain visible. No new saved selection exists: a Starting point is a patch to rules, not a persistent mode or a new source of truth.

## Text formatting

Text and consent add a plain-string italic field, filled at %i and rendered with a semantic em element. It follows the existing bold/link model: one phrase per kind, no nested formatting, and no HTML interpretation. Repeated authored placeholders retain the explicit-field editor. Clear formatting removes the selected phrase's marks, or all marks without a selection, while preserving words. Command/Control+B, I and K invoke the toolbar actions.

The template manifest declares italic for both content and copying, so normalization and template switching retain it. The renderer and Consent Record compose the same sentence. Both remove empty marks before expanding each kind once; replacement words are never parsed again. Shared fixtures cover missing/repeated italic, literal HTML and a link label containing another placeholder.

No table or column changes are involved. No editor dependency is added. A future editor with multiple ranges or overlapping bold/italic/link needs a structured run model; it should not add more placeholder workarounds. Library research and the recommended scope are recorded in [the follow-up audit](../reviews/editor-followup-2026-09-11.md).

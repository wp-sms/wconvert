# Picture transfer and practical style controls

Merchants primarily customize an existing design. This pass improves that path:
preserve their pictures when switching designs and make existing CSS values
easier to edit. Moving blocks between containers remains deferred.

## Picture transfer

`PictureTransfer` joins the existing snapshot path beside Slot Role copy and
merchant button destinations. It compares image blocks and painted backgrounds
against the original library entry. Untouched sample assets stay with the new
design; modified pictures and crop positions can travel. Image IDs identify the
baseline after reordering. Matching uses picture kind and ordinal within the
same screen only when both sides have the same number of slots.

A single picture can move between an image and a background slot where the
match is unambiguous. A background may become a decorative image; an image with
meaningful alt text cannot become a decorative background silently. Root
backgrounds can match the main screen, never a success-only picture. A target
root is a destination only when it declares a background layer; an ordinary
plain design is not assumed to provide a readable photo backdrop. Panel and
media nodes explicitly provide picture slots even when currently empty. Narrow
photos retain their own background slot; cross-kind transfer does not guess
mobile geometry. New design palettes, overlays and layout dimensions remain
the new design's. A sample narrow photo cannot cover a carried desktop photo.

The snapshot response includes transient counts for pictures with no clear
destination and pictures whose original baseline is unavailable. Keep my content
shows these before Apply. Sample mode omits these notices. Apply strips the
report and uses the exact reviewed tree/tokens as one undoable draft edit.
No media is downloaded, copied or generated; stored asset references travel.

## Style controls

Manifest controls declare padding as spacing and overlays as gradient-capable.
Background layers also offer gradients. These remain ordinary existing token
strings, with no renderer or persisted document format change.

Padding expands one through four CSS values into physical Top/Right/Bottom/Left
controls. Unlinking writes nothing; linking explicitly applies the top value to
all sides. Negative or complex expressions remain in Custom CSS. Units are
explicit and changing them never guesses a conversion. *Amended by [ADR 0135](0135-plain-style-controls-exact-values-under-advanced.md):
Custom CSS, units, gradient degrees and stop positions are shown under
Advanced only; the plain view keeps presets, swatches and the color stops.*

Visual gradients support a single linear gradient with two to six color stops,
positions and direction. Alpha uses the existing color picker. Unsupported or
ambiguous syntax remains editable verbatim in Custom CSS. Opening controls
never rewrites a value. All changes use the existing draft history.

The selected element lists its own mobile overrides in both scopes. Desktop
controls mark values that differ on mobile. Reset removes only that element's
narrow bag, returning it to normal inheritance; it does not reset descendants
or desktop styling. *Amended by [ADR 0135](0135-plain-style-controls-exact-values-under-advanced.md):
"Reset this element" clears the bag for whichever device is being edited — the
narrow bag on mobile, the element's own style tokens on desktop — and still
never descendants.* This introduces no per-device copy, order or visibility.

See [review and verification](../reviews/content-transfer-style-controls-2026-09-14.md).

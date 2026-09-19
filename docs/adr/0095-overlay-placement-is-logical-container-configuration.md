# Overlay Placement is logical container configuration

Amends [ADR 0011](0011-non-modal-overlays-use-the-popover-top-layer.md).

A floating bar may sit at `block_start` or `block_end`. A slide-in may sit at
`block_start_inline_start`, `block_start_inline_end`,
`block_end_inline_start`, or `block_end_inline_end`. These are the complete
public vocabulary. Physical left/right values are not stored: logical values
follow the site's writing direction without duplicating a campaign for RTL.

Placement belongs to the container, beside `display_type` in the Optin config.
It is not a Template tree field or token. The Template still decides what the
campaign looks like; the container decides where that copy is presented. One
placement applies at every responsive width in this phase.

## Defaults and normalization

Absence preserves the shipped behavior: `block_end` for a floating bar and
`block_end_inline_end` for a slide-in. Explicit defaults are removed, so every
existing campaign and every campaign using the common position pays no payload
bytes. Unknown values, placements belonging to another Display Type, and every
placement on `popup` or `inline` are also removed at the write boundary.

Extended by [ADR 0098](0098-fullscreen-is-a-pro-modal-surface.md): `fullscreen`
also never retains placement; it occupies the entire viewport.

Extended by [ADR 0099](0099-automatic-inline-placement-uses-rendered-content.md):
inline automation uses the separate `inline_placement` setting, not this logical
overlay `placement`. Template JSON still does not change.

Applying another design of the same Display Type preserves placement. Changing
Display Type resets it in the same undoable draft edit. No database schema and
no Template JSON migration are introduced; the existing Optin configuration
JSON already owns this container fact.

## A top bar uses two boxes for two jobs

The visible bar remains `[popover=manual]` in the top layer. Moving it into the
document to push content would reintroduce the transformed-ancestor and z-index
failures ADR 0011 was written to prevent. A companion first child of `body`
therefore reserves the occupied viewport strip in normal flow while the visual
box remains protected above it.

The reservation follows the bar with `ResizeObserver`, including responsive
wrapping and screen changes, and is removed idempotently on every normal close
path. `--wconvert-top-bar-offset` exposes the same measured value for a theme's
fixed chrome. Pre-existing inline values are restored. If reservation cannot be
established, the campaign remains a visible fixed overlay; placement failure
must not become campaign disappearance.

This is best-effort theme integration. Normal and in-flow sticky headers are
covered by the reservation, but arbitrary fixed headers cannot be safely
rewritten by a plugin and may need to consume the custom property. A delayed
top bar necessarily moves layout once by its occupied height. The editor says
so and recommends checking the real header; bottom placement remains the
no-reflow choice.

## Consequences

- Runtime insets and stored values are logical. Safe-area left/right values are
  mapped to logical start/end by writing direction.
- Entry motion comes from the selected block edge and reduced-motion behavior
  is unchanged.
- The builder uses pictorial edge/corner choices and its page canvas renders the
  selected position at desktop and mobile widths.
- Bundled bar shadows are placement-neutral. Merchant-authored token values are
  never parsed or rewritten by the loader.
- The largest loader is 12,567 B gzipped with this behavior. The hard per-build
  ceiling moves from 12,288 B to 12,800 B rather than weakening reservation,
  safe-area handling, or unrelated Elite cart validation. That remains 872 B
  below the smallest measured competitor runtime in ADR 0014.
  [ADR 0098](0098-fullscreen-is-a-pro-modal-surface.md) subsequently adds
  fullscreen and raises that hard ceiling to 13,500 B; the above measurement
  describes the placement-only build.
- Popup positioning, per-device placement, arbitrary offsets, teasers and new
  Display Types remain separate decisions.

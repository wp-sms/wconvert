# Manual inline placement uses WordPress layout surfaces

**Extended by [ADR 0102](0102-content-lock-is-an-optional-inline-capture-journey.md):** the ordinary manual block remains unchanged. Pro additionally offers a content-region container block with saved InnerBlocks and a paired shortcode; this separate journey extends configuration and payload without changing Template JSON or the schema.

Phase 4 of #165 makes the existing manual inline Campaign block usable and
discoverable in the places WordPress already owns. It does not introduce a
sixth Display Type, a WConvert widget, or automatic sidebar selection.

## One block across content and layout

`wconvert/inline-optin` remains the one block. In a classic theme it can be
placed in any widget area the active theme registered through Appearance →
Widgets or the Customizer's block widget editor. In a block theme it can be
placed in a template or template part through the Site Editor. A classic Text
widget, Shortcode block, page-builder shortcode element, or theme call to
`do_shortcode()` uses the existing `[wconvert_optin]` fallback.

WordPress decides which widget areas, templates and template parts exist.
WConvert does not register a sidebar, edit a theme, move a block, or infer that
one area is a footer. The admin links to the Site Editor only for a block theme,
and to Widgets only for a classic theme with at least one registered sidebar;
both links require `edit_theme_options`. Otherwise the block and shortcode
instructions remain without an unusable link.

Manual placement stays Free and remains the default. Automatic inline placement
stays in every paid tier. Goal-first creation, targeting, schedule, frequency,
visitor conditions, capture and viewport-based Impressions are unchanged. A
manual Anchor anywhere for a campaign or its A/B family continues to take
precedence over automatic placement.

## Authoring and rendering boundaries

Placement help belongs under Display rules → Placement and in publish review,
never in Design. The WConvert screen uses Harbor controls; the block itself uses
WordPress's native Placeholder, Notice and SelectControl. The post, Widgets and
Site editors choose only which published inline Campaign an ordinary Anchor names.
As detailed in ADR 0102, Pro Content lock uses a separate readiness-aware picker
with an authenticated post-author refresh endpoint; the ordinary picker remains
enqueue-only. They
do not load the Campaign renderer or become a second design surface.

The block remains dynamic and shares `InlineAnchor` with the shortcode. Repeated
manual placement of the same Campaign keeps the established contract: the first
Anchor renders, later duplicates stay empty, and one Impression is possible.
Different Campaigns remain independent.

The block metadata declares API v3 for current WordPress. Registration supplies
API v2 on WordPress 6.2, where v3 did not exist, and v3 from WordPress 6.3 onward.
This compatibility bridge changes no saved block markup. A separate dependency
issue makes the advertised WordPress 6.2 minimum inaccurate: normal activation
fails in Action Scheduler because `wp_is_serving_rest_request()` is unavailable.
The historical 6.5 function boundary is not a supported-version promise. The
currently bundled Action Scheduler 4.1.0 declares a WordPress 6.8 minimum;
normal activation and editor smoke checks pass on 6.8 and 7.1.1. See the
[compatibility review](../reviews/2026-09-20-content-lock-compatibility.md).
Aligning the global plugin metadata remains a separate release support decision.

Template JSON, the database schema, the published payload, and the visitor
loader contract do not change.

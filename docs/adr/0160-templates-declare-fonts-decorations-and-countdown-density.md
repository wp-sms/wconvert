# 0160: Templates declare fonts, decorations and countdown density

Accepted 2026-10-21. Implements the Halloween design exploration without adding
position, animation or countdown sizing controls to the merchant editor.
Amends 0010, 0055, 0062 and 0159.

## Font requirements and site permission are separate

`tree.fonts` declares at most four Google families, each with at most twelve
`faces` (`weight`, `italic`). Families are names, never URLs or CSS. The
existing `font` and `heading-font` tokens remain CSS stacks with fallback faces.
Requirements survive normalization, copy binding, snapshots and file transport.
An imported design cannot carry site permission. A manually entered stack
without an explicit requirement never initiates a Google request.

The font picker retains site/system fonts and adds a local, searchable starter
selection of Google families. Choosing one writes its stack and requirement in
one undoable draft edit. Installed site families are offered once. A design
missing fonts uses its fallback stack and explains how to install the font in
WordPress or enable Google delivery. The existing Font Library is still the
local-hosting path; WConvert adds no upload manager or font-file cache.

`wconvert_google_fonts` is a WordPress option, off by default. Enabling requires
an explicit acknowledgment through Settings → Data & privacy; the API also
requires that acknowledgment when changing from off to on. Disabling requires
no confirmation. The disclosure names Google, browser connections and IP
addresses, including editor previews. This is the merchant's acknowledgment,
not visitor consent or a legal-compliance claim. No new tables or columns.

The payload reads current site policy, strips remote requirements when disabled,
and excludes families declared by the site. Mounting alone fetches nothing:
showing a campaign requests its declared, used, missing families at document
level with `display=swap`. Exact requests are deduplicated; failures retain
fallbacks and can retry on another appearance. Closing does not undo browser
caches. The active editor preview uses the same delivery helper; gallery cards
do not initiate font requests. Cached pages can hold an older permission, so
saving purges supported caches and Settings explains the host/CDN follow-up.
The Data Map, WordPress policy suggestion and readme disclose the connection.

## Decorations are authored, not arranged by merchants

`panel` and `media` may carry `decorations: {label, hidden, items}`. Each item
selects a closed original shape (`bat`, `eyes`, `sparkle`), a token color, a
bounded percentage position, a size in pixels, optional narrow placement, and
one motion preset (`none`, `float`, `flap`, `blink`). Maximum eight per group.
No raw SVG, external artwork, CSS or script is accepted. This first set supports
our Halloween motion examples; new artwork needs an explicit vocabulary/runtime
addition rather than an arbitrary uploaded image inheriting unsuitable motion.

The Look panel discovers these groups and shows one checkbox per group, using
its authored label. No declaration means no control. Hiding preserves the
configuration but renders no decoration DOM. Main artwork remains independently
replaceable with the existing image controls. Visible decorations are positioned
inside their painted panel without increasing its height, sit below content,
ignore pointer events and are hidden from accessibility. Motion respects reduced
motion, pauses offscreen/in hidden documents, and stops on close; observers and
listeners are cleaned up. No animation framework is added.

## Compact countdown is a presentation, not another clock

`countdown.density: compact` modifies `layout: boxes`; omitted/regular preserves
existing output. The template chooses it; `choices` deliberately exposes no
new editor control. Fixed cell widths (52px wide, 35px in narrow containers)
and tabular numbers prevent digit changes from resizing the row. Labels wrap
inside their allotted cells. Unit labels, colors and deadline remain editable.
The fixed end time, hiding zero days and one silent timer retain ADR 0052/0159.

## Evidence

`tests/fixtures/halloween-features.json` is a review fixture, not a newly
published library design. It exercises the font requirement, bat group and
compact countdown together. Unit coverage includes acknowledgment/default-off,
closed nested input, snapshot survival, font request timing/deduplication,
decoration hiding/lifecycle and editor confirmation. Browser review additionally
checks real WordPress saves, phone dimensions and reduced motion. Existing
loader budgets remain unchanged; no new runtime dependency was added.

## Library examples

The five Halloween prototypes now have bundled library counterparts: midnight
print, treat with teeth (including its acknowledgement), after dark, midnight
flight and drop countdown. The first four are Free popups; the countdown is a
Pro floating bar. They declare DM Sans plus Archivo Black or Instrument Serif,
retain system fallbacks, and never enable Google delivery themselves. Midnight
flight declares a Flying bats group. The bar retains its small pumpkin and uses
compact boxes; its cells are 35px through 32rem containers to fit beside the action and the bar’s dismiss control on phones.

Original prototype raster backgrounds are encoded to WebP and shipped under
content hashes. The existing bundled artwork resolver now handles exact
`bg-image` raster values as well as image leaves, keeping campaign snapshots
small without adding a token or restricting ordinary image replacement.
Unknown or altered files are never substituted. These bundled examples do not
publish a hosted catalogue release or change the catalogue asset-binding schema.
Review evidence lives in `docs/reviews/halloween-library-2026-10-21`.


## The editor reads the artwork and edits the shared deadline

Look's Picture section reads a screen root's own background when it declares
one, labels it as this screen's picture, and writes back to that scope. Mobile
reads its override (or desktop) and writes only the mobile bag. Designs whose
picture lives in the shared tokens keep the shared control. Replacing or
removing artwork must not flatten the tree or alter the other screens.

Simple Gap and Corner rounding presets compare numeric lengths, so `.8rem`
and `0.80rem` match `0.8rem`. A visible Current value accompanies the buttons,
including Custom values; reading a value never rewrites the document.

The countdown inspector offers a date/time field that edits the same campaign
`ends_at` as Display rules. It states the site timezone and that the campaign
stops showing at that time, warns about an end before the start, and supports
clearing the deadline. No node deadline or new storage is introduced. The
canvas remains a design sample and the inspector explicitly labels its sample
time; the visitor timer continues to use PHP's resolved schedule deadline.

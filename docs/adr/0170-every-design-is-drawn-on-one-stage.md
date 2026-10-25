# 0170: Every design is drawn on one stage

Accepted 2026-10-25. Amends 0010, 0043, 0065, 0067, 0112, 0137 and 0156.

## Eight places drew a design five ways

The admin showed a design in eight places — the gallery card, a hosted card,
setup and design inspection, the editor canvas, the campaign list and its
details, the occasion page, the launch review, the journey rail and the
form-change tiles — with five copies of scale-to-fit code and four render
widths. The gallery card used a fixed `zoom: .55`, so a wide, short design
such as `inline-cta` (736px) was a strip in a grey box, and a hosted card's
picture sat in a different frame from a local card's render.

The approved prototype (v5, 2026-10-24, branch `prototype/template-gallery`)
is the spec for what replaces them.

## Decisions

1. **One module, `resources/admin/src/stage/`.** `DesignStage` draws a design
   at one of four sizes — `card`, `thumb`, `inspect`, `canvas` — and every
   surface above uses it. `PreviewFrame`, `EditorCanvas`, `CampaignDesign`,
   `JourneyScreenCard` and the form-change tiles are now thin callers.
   `JourneyTest` is out: it is an interactive test runner with an open root.
2. **One render width, `renderWidth(tokens, format, device)`.** A bar draws at
   880 and a fullscreen at 1024; a popup at its own token width (448 when it
   declares none), a slide-in at `min(token, 416)`, an inline design at
   `min(token, 680)` (640 when it declares none). A `%` or `min()` width falls
   back to the default. A live render is handed `width: 100%` against an anchor
   of that width — `mountModal`'s approach — except a fullscreen, which keeps
   its token as the measure of its content.
3. **Mobile is a 360 × 720 phone everywhere.** Bars and fullscreens are 360
   wide, the rest at most 328, drawn at scale 1 on the phone and the phone
   fitted into the stage. The old widths (320 in inspection, 352 on the canvas)
   are gone.
4. **Each format has a slot on a faint page, `place()` in `geometry.ts`.** A
   pure function of the framing, the stage size and the design size. On
   desktop: a popup is centred in 72% × 88% over a dim; a slide-in takes
   50% × 86% in the end corner, 4% in and 7% up, mirrored in RTL; an inline
   design is centred in a band 88% × 60% starting 22% down, on a plate that
   runs the page's width 2% above and below it (so the page's lines never
   peek past a design the cap keeps narrower than its band); a bar
   spans the top at `scale = W / w` and the page starts under it; a fullscreen
   is `W / 1024` across and as tall as the page. A saved placement (a bottom
   bar, a slide-in's corner) moves the slot; a card has none. The scale is
   capped at 1.25, or 1 on the canvas. **Actual size** (the inspect toggle,
   "Actual width" before this) grows the page until the slot holds the design
   at scale 1, and the stage scrolls and becomes a named, focusable region.
   The fractions live in one table that fit and actual size both read. The
   coordinates are physical and already mirrored, so the stage is a
   `dir="ltr"` scroll box whose page takes the admin's direction back
   (GUIDELINES §15's laid-out-picture exception, as the Flow map).
5. **Local is live, hosted is a picture, and the stage frames both.** A design
   on this site always renders through `Preview`, never a raw `mount()`, so
   coupon space, the phone field and Pro's format surfaces come with it. A
   design only the catalogue has is its 600w/1200w picture, offered with a
   `srcset` by width, `sizes` set to the pixels it is drawn at, and
   `referrerpolicy="no-referrer"`. It is laid out at 600 wide and its height
   comes from its own aspect, so no server change was needed.
6. **`transform`, not `zoom`.** The old gallery let the design size its card,
   so it needed the scale that moves layout. A stage has its own shape (4:3 on
   a card, 16:10 in inspection) and computes the design's place inside it, so
   nothing outside depends on how big the design is drawn and `transform` is
   right again. `useFitScale` is one ResizeObserver over the stage and the
   design; `offsetWidth`/`offsetHeight` ignore transforms, so the scale never
   feeds back into its own measurement.
7. **Cards and thumbs mount near the viewport** (ADR 0043's gate, moved into
   the stage): one IntersectionObserver with a 600px margin decides both when
   a tree is worth fetching and when it is worth drawing. A fixed shape means a
   card no longer changes height when its design leaves, so the held height
   `TemplateCard` kept is gone; `content-visibility: auto` stays.
8. **The ghost page is admin tokens** (`--ghost-page`, `--ghost-ink`,
   `--ghost-soft`, `--ghost-dim`), sized in container units on a size
   container, with a thumb variant that drops the details. None of it is
   translucent, so tree order alone keeps the design on top.

## Consequences

The canvas keeps its selection paths, placement, Fit/100% zoom, the stand-in
close button (drawn on the design and scaled with it) and its own screens
(`screen`), which stand on the page in place of the design; an in-flow screen
hides the ghost page. Campaign thumbnails gained their format, so a bar no
longer draws as a card. `LockPreview` is unchanged: it is a canvas screen.

The gallery's `zoom` block, the old mock page (`.wconvert-site*`), the canvas
slot rules, the hosted-thumbnail cap, the per-surface fit CSS and the dead
`.wconvert-pack-detail*` rules are deleted. The pickers themselves are
unchanged by this ADR; ADR 0171 replaces them.

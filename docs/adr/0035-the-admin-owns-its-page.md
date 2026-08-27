# The admin owns its page

WConvert's admin screen renders **none of WordPress's admin chrome**. No
`nav-tab`, no `wp-list-table`, no `.button`; Tailwind's preflight applies to the
whole page and admin notices are suppressed on it. Everything a merchant sees on
`admin.php?page=wconvert` is WConvert's, drawn from WConvert's own tokens.

That is a reversal. The screen shipped as WordPress defaults throughout, and
[#62](https://github.com/navidkashani/wconvert/pull/62) built its section nav out
of `nav-tab` markup a fortnight before this was decided. **That nav is
scaffolding this ADR replaces** — it was the right call for closing an IA gap in
one afternoon and the wrong shape to build five screens on.

## The hybrid was the option to beat, and it lost to both

Three postures were available: keep WordPress's chrome and style only what is
ours; own the page outright; or the middle — utilities without preflight, our
controls inside WordPress's frame.

The middle is the one that looks cheapest and reads worst. A screen whose tabs
and tables are WordPress's and whose panels are ours does not read as *"a plugin
that respects the platform"* — it reads as one that started a redesign and
stopped. The two halves disagree on radius, on weight, on spacing and on focus,
and every screen has a seam down the middle of it where they meet. Both pure
options are better than that, so the middle was eliminated before either was
argued.

## Who the merchant is decided the rest

The benchmark is not wp-admin. It is OptinMonster, Convert Pro and ConvertKit —
lead capture is a category where the competition is SaaS-grade, and a merchant
evaluating the goal-first flow is comparing it to those, not to
Settings → Permalinks. Against that benchmark, default admin styling reads as an
abandoned plugin.

WSMS reached the same place from the same premise and is the convention source
this repo already follows: it imports Tailwind with `important`, keeps no
WordPress classes anywhere in `resources/react/src`, and calls
`remove_all_actions('admin_notices')` on its own screens. It is worth being
explicit that this ADR follows WSMS *because the argument holds*, not because
WSMS did it — the sibling could be wrong, and on the sidebar-versus-tabs question
([ADR 0036](0036-admin-components-are-vendored-from-upstream.md)) it is treated
as a response to a scale WConvert does not have.

## What owning the page costs, stated rather than discovered

WordPress's chrome is not only a look. It is keyboard behaviour, focus rings,
RTL, high-contrast mode and the admin colour schemes, all of which arrive free
with `.button` and none of which arrive with a `<button>` we style ourselves.

- **Radix covers most of it.** Keyboard interaction, focus management and ARIA
  are the whole reason the primitives are worth a dependency
  ([ADR 0036](0036-admin-components-are-vendored-from-upstream.md)).
- **Contrast and colour are ours**, and are held to WCAG 2.1 AA with a lint gate
  rather than an intention
  ([ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md)).
- **The eight admin colour schemes are ignored**, deliberately. Mapping them onto
  a token set is an eight-way compatibility matrix serving a preference the
  merchant expressed about *WordPress*, on a screen that is no longer WordPress's.
  A merchant who chose "Midnight" did not thereby ask WConvert to be dark.

## Preflight is the risk, and it is a real one

`@import 'tailwindcss'` includes preflight, which resets margins, list styles and
form-element appearance across the document — including on the parts of the page
WordPress still owns: the admin menu, the toolbar and the footer.

WSMS runs exactly this configuration in production, which is the strongest
evidence available that it holds. It is still the single thing most likely to go
wrong here, and it fails *outward* — a broken admin menu is a broken WordPress,
not a broken plugin screen. **It is proven on one screen end to end before the
other four are built**, so the discovery happens once rather than five times.

The `important` flag is part of the same posture: wp-admin's stylesheet has high
specificity and loads after ours, so utilities that are not `!important` lose to
it in ways that appear only on the screens nobody checked.

## Consequences

- **`nav-tab` from [#62](https://github.com/navidkashani/wconvert/pull/62) is
  reskinned, not kept.** The hash-routed section model it built is unaffected —
  that was always the load-bearing half, and `resources/admin/src/nav.ts` is a
  pure translation with no markup in it.
- **Admin notices are suppressed on WConvert's screens only**, by hook suffix,
  the way `AdminMenu::enqueueAssets()` already scopes the bundle. A plugin that
  silenced notices everywhere would hide the update nags and the security
  warnings that are the whole point of them.
- **The plugin's own notices must not go through `admin_notices`**, because it is
  being emptied. `ViteHelper::noticeMissingAdminBundle()` and
  `LoaderEnqueue::noticeMissingLoaderBundle()` both use it today; the first fires
  on exactly the screen being suppressed and would silence itself. Both need a
  path that survives.
- **Every control is ours to get right, including the ones nobody thinks about** —
  disabled states, focus-visible, `prefers-reduced-motion`, and what a 200-row
  lead table does on a narrow viewport.

  _Completed by [ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md):
  this ADR made the page ours without saying how anything is arranged on it, and
  the five screens then each invented an arrangement — no loading states, four
  different kinds of empty state, page-level errors far from the control that
  failed, and no confirmation on anything destructive. 0039 is the layout grammar
  that was missing: five page parts in one order, placement decided by what a
  control acts on, three declared states per region, and 640px as the table's own
  breakpoint — the answer to the 200-row question this bullet left open._
- **Dark mode becomes possible rather than required.** Ignoring WordPress's
  schemes means the tokens answer to nothing external, so a
  `prefers-color-scheme` implementation is a second set of values against the
  same names and lands without touching a component
  ([ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)).
- **The builder's live preview is unaffected in both directions.** It mounts in a
  closed shadow root ([ADR 0009](0009-overlays-render-in-the-top-layer.md),
  [ADR 0011](0011-non-modal-overlays-use-the-popover-top-layer.md)), so neither
  preflight nor any admin utility can reach a rendered [[Optin]], and the
  popup's own tokens cannot leak out onto the panel editing them. This was the
  one collision worth checking before deciding, and it does not exist.

  *Amended by [ADR 0040](0040-the-builders-preview-is-an-input.md): the preview
  is no longer unaffected in **both** directions. It is now an INPUT — clicking a
  slot puts the caret in the block that edits it — so one direction is deliberate
  traffic. The CSS claim above is untouched and is the reason this was cheap:
  nothing crosses the boundary but a string naming a slot, and the outline the
  admin paints is set inline rather than through a stylesheet that could not
  reach in.*

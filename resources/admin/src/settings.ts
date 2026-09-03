/**
 * What `AdminMenu` puts on the page beside the bundle.
 *
 * One module rather than a `declare global` beside each reader: a global
 * interface merged from several files stops being readable in any of them, and
 * this one is read by two screens that share nothing else — the lead log wants
 * the CSV URL, the builder wants the dev flag.
 *
 * **It arrives as JSON rather than through `wp_localize_script()`**, which
 * casts every value to a STRING: `true` would reach here as `"1"` and `false`
 * as `""`, so a screen testing the flag would be quietly wrong rather than
 * loudly broken. That is how the dev-only export shipped invisible on exactly
 * the installs it exists for.
 */

export interface AdminSettings {
  /** The nonced `admin-post.php` URL for the CSV export. */
  readonly exportUrl: string;
  /**
   * `WP_DEBUG`. The builder's library-entry export is the only thing that
   * reads it — authoring is the settings panel plus a **dev-only** export
   * (ADR 0010).
   */
  readonly dev?: boolean;
  /**
   * `get_privacy_policy_url()`, or absent where the site has none configured.
   *
   * **The admin has to resolve the consent link itself** (#77). `PolicyLink`
   * runs on the published payload and on the capture path, and neither is a
   * path the admin reads — so every preview, every gallery card and the
   * creation flow's last step rendered the fine print as *"See our."* while the
   * front end rendered it correctly.
   *
   * It is a value beside the bundle rather than a route because it is one
   * site-wide string that cannot change while the page is open, and because it
   * must reach the RENDER rather than the config: an href resolved into
   * something the builder saves back is an href frozen at publish, which is the
   * thing ADR 0032 exists to prevent. See `builder/policy.ts`.
   */
  readonly policyUrl?: string;
  /**
   * `home_url('/')` — where the eligibility inspector's dialog starts.
   *
   * The merchant does not describe a page to the inspector, they open one: a
   * `RequestContext` cannot honestly be built from a URL (ADR 0048), so the
   * dialog's only job is to feed `window.location`.
   *
   * It comes from WordPress rather than from `location.origin` because a
   * subdirectory install has to land on the SITE rather than on the domain
   * root — `/blog/pricing` against `/pricing` is what half the real Targeting
   * confusion is about.
   */
  readonly homeUrl?: string;
  /**
   * The query parameter that turns the inspector on, spelled in PHP.
   *
   * `InspectorEnqueue::PARAM` is the one place it is decided, and it travels
   * here rather than being written a second time in TypeScript — a renamed
   * parameter would otherwise leave this screen linking to a page that
   * renders no panel, silently.
   */
  readonly inspectParam?: string;
  /**
   * What to call each paid tier, keyed by slug — `basic`, `pro`, `elite`.
   *
   * ==========================================================================
   * THE WORD ON AN UPSELL IS DATA, NOT A LITERAL IN FIVE COMPONENTS.
   * ==========================================================================
   * Free's admin renders the `locked` state for every member this install does
   * not have, and the word on that badge used to be `__('Pro')` written out in
   * the goal screen, the gallery, two rule surfaces and the starting points.
   *
   * At launch every rung answers `"Pro"`, so nothing on screen changes. What
   * changes is what it costs to sell a second tier: an edit to `tiers.json`
   * rather than five strings and a release, and no migration of the `tier`
   * values already saved on live Optins (ADR 0056).
   *
   * `name` is the badge — short, sits in a chip. `product_name` is the thing on
   * the invoice, and it is what a sentence names: *"Available with %s."*
   *
   * **Not translatable, and that is the trade.** `make-pot` cannot see a JSON
   * string, which is why every other piece of merchant-facing copy lives in PHP
   * (ADR 0013). A tier's name is a product name, so it is the one string that
   * should not be translated; the sentence around it still is.
   */
  readonly tiers?: Readonly<Record<string, { readonly name: string; readonly product_name: string }>>;
}

declare global {
  interface Window {
    wconvertAdmin?: AdminSettings;
  }
}

/**
 * Absent is a real answer, not an error: the screen changed and the localised
 * object was left behind, or a test rendered a component without one. Every
 * reader has to survive it, so none of them gets a throw.
 */
export const adminSettings = (): AdminSettings | undefined => window.wconvertAdmin;

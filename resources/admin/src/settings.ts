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

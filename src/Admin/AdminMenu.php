<?php

namespace WConvert\Admin;

use WConvert\Assets\ViteHelper;
use WConvert\Frontend\InspectorEnqueue;
use WConvert\Support\Availability;
use WConvert\Support\ProPresence;
use WConvert\Support\TierManifest;
use WConvert\Support\WpProPresence;
use WConvert\Template\DesignBudget;

defined('ABSPATH') || exit;

/**
 * The WConvert admin screen.
 *
 * One top-level menu page holding one mount node. Everything the merchant sees
 * is React, rendered from the Vite build; PHP's whole job here is to reserve
 * the page and put the bundle on it.
 *
 * @since 0.1.0
 */
final class AdminMenu
{
    /**
     * The [[Module]] directory A/B testing ships in.
     *
     * Free names it because free is what renders the `locked` card for it, on
     * the same footing as every `tier:` value in the rule manifest and on every
     * [[Goal]] — free's PHP can only mark a capability absent for a rung it can
     * name (ADR 0005, ADR 0015). Which rung that is stays `tiers.json`'s to
     * say.
     */
    private const VARIANT_MODULE = 'ab-testing';

    public const SLUG = 'wconvert';

    /**
     * The handle the admin bundle is registered under.
     *
     * **Public because [[Pro]] replaces this bundle by dequeuing it**
     * (ADR 0014, extended to the admin): Pro ships free's screens plus its own,
     * composed in Pro's entry where the bundler can see them, and swaps the
     * script in PHP before a byte of HTML exists. A handle spelled twice is two
     * strings that agree by habit, and the day this one is renamed the swap
     * would silently stop happening and the page would carry two React apps.
     */
    public const SCRIPT_HANDLE = 'wconvert-admin';

    /**
     * When this runs on `admin_enqueue_scripts`.
     *
     * A named constant for the reason {@see \WConvert\Frontend\LoaderEnqueue::PRIORITY}
     * is one: Pro replaces this bundle on the same hook, later, and "later" has
     * to be a fact the two plugins share rather than two numbers. It must not
     * depend on load order — WordPress loads active plugins in the order its own
     * option lists them, so a swap that worked because `wconvert-pro` happened
     * to be read after `wconvert` would work by accident.
     *
     * 10 is `add_action`'s own default, which is what this hook ran at before
     * it was written down. Naming it changes nothing about when it fires.
     */
    public const PRIORITY = 10;

    private string $screenId = '';

    public function __construct(
        private readonly AdminNotices $notices,
    ) {
    }

    public function hooks(): void
    {
        add_action('admin_menu', [$this, 'registerMenu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueueAssets'], self::PRIORITY);
    }

    public function registerMenu(): void
    {
        $screenId = add_menu_page(
            __('WConvert', 'wconvert'),
            __('WConvert', 'wconvert'),
            'manage_options',
            self::SLUG,
            [$this, 'renderScreen'],
            'dashicons-megaphone',
            26
        );

        // false when the current user lacks the capability, in which case there
        // is no screen to match against and nothing to enqueue.
        $this->screenId = is_string($screenId) ? $screenId : '';

        // The one place this suffix is learned, and both things that scope by
        // screen read it from here: the bundle enqueue below, and the notice
        // suppression that empties `admin_notices` on WConvert's screens and
        // nowhere else (ADR 0035).
        $this->notices->owns($this->screenId);
    }

    /**
     * The plugin's own notices, then the mount node.
     *
     * **No `.wrap`.** That class is what insets a WordPress screen and draws
     * WordPress's heading rhythm around it, and this page is WConvert's
     * (ADR 0035) — the frame, the type and the spacing are the admin bundle's,
     * over tokens the plugin owns.
     *
     * The notices come first and come from PHP, because
     * {@see AdminNotices::renderOwned()} is the only path that can report a
     * missing admin bundle: that failure leaves no React to render a message
     * with. It runs after `admin_notices` was emptied on this screen, which is
     * the whole reason it exists.
     */
    public function renderScreen(): void
    {
        $this->notices->render();

        echo '<div id="wconvert-admin"></div>';
    }

    /**
     * Enqueue the admin bundle on the WConvert screen only.
     *
     * Matching on the hook suffix add_menu_page() returned rather than on a
     * hand-built string: the suffix is what admin_enqueue_scripts is passed,
     * and building it here would be a second spelling of the same fact.
     */
    public function enqueueAssets(string $hookSuffix): void
    {
        if ($this->screenId === '' || $hookSuffix !== $this->screenId) {
            return;
        }

        ViteHelper::enqueueAdmin(self::SCRIPT_HANDLE, $this->notices);

        // **WordPress's own media picker, for the builder's image slot.** An
        // `image`'s `src` was a text box asking a merchant to type a URL for a
        // file they had already uploaded — and `MerchantsOwn` carries that
        // value across a design switch precisely because it is theirs to set.
        //
        // It is WordPress's script, on one screen, and the admin bundle has no
        // byte gate — its size is printed at every build rather than enforced
        // (ADR 0038) — so this is reportable rather than a budget decision. The
        // editor degrades to the URL field where it is absent, so nothing here
        // is load-bearing for setting an image.
        wp_enqueue_media();

        /*
         * ====================================================================
         * THE THEME'S OWN FACES, SO THE FONT PICKER DRAWS ITS ROWS IN THEM.
         * ====================================================================
         * The picker offers the families this SITE declares and sets each row
         * in the face it names — which is the whole value of the control, and
         * which needs the `@font-face` rules to be on this page. Core prints
         * them on the front end; wp-admin gets them only where something asks.
         *
         * Core's own, since 6.4, and guarded because this plugin's floor is
         * 6.2 — where it is absent the row falls back to the next family in the
         * stack and the control still works. **Nothing is fetched and no face
         * is declared here**: this prints the site's, or nothing
         * (`docs/adr/0055-the-font-list-is-the-sites.md`).
         */
        if (function_exists('wp_print_font_faces')) {
            add_action('admin_print_styles', 'wp_print_font_faces');
        }

        // `wp_add_inline_script()` rather than `wp_localize_script()`, and the
        // difference is not stylistic: `localize` casts every value to a
        // STRING, so `true` arrives in the browser as `"1"` and `false` as
        // `""`. A boolean that reads as `"1"` is worse than one that reads as
        // `true` and worse than one that is absent — the screen tests it and
        // is quietly wrong, which is how the dev export shipped invisible on
        // an install that had `WP_DEBUG` on. `wp_json_encode()` keeps the type
        // the setting actually has.
        wp_add_inline_script(
            self::SCRIPT_HANDLE,
            'window.wconvertAdmin = ' . wp_json_encode(self::settings()) . ';',
            'before'
        );
    }

    /**
     * What the screen is handed before its bundle runs.
     *
     * ========================================================================
     * PUBLIC BECAUSE PRO REPLACES THE SCRIPT AND WOULD OTHERWISE LOSE THESE.
     * ========================================================================
     * `wp_add_inline_script()` attaches to a HANDLE, and Pro deregisters this
     * one (ADR 0014) — so the inline script above goes with it, and a Pro
     * install would boot the admin with no `window.wconvertAdmin` at all: no
     * export URL, no policy link, no inspector door. Every one of those fails
     * as a missing feature rather than as an error, which is the shape that
     * ships.
     *
     * So the settings are a value both sides can ask for rather than a
     * statement made once at the moment of enqueue. Pro attaches the SAME
     * values to its own handle ({@see \WConvert\Pro\Admin\ProAdminEnqueue}),
     * which is the one direction the split allows — Pro reaches into free.
     *
     * Static, because none of it is a fact about this menu instance: every
     * value is read from WordPress or from a free constant at the moment the
     * screen is enqueued.
     *
     * @return array<string, mixed>
     */
    public static function settings(): array
    {
        $manifest = TierManifest::load();

        return [
            // The CSV download is a navigation to `admin-post.php`, so the
            // screen needs the nonced URL rather than a REST path —
            // `apiFetch` would read the file into memory and then have to turn
            // it back into a download.
            'exportUrl' => LeadExport::url(),
            'installedTier' => (new \WConvert\Support\WpProPresence())->installedTier()->value,
            // **Authoring is the settings panel plus a DEV-ONLY export**
            // (ADR 0010). Gated on `WP_DEBUG` rather than on a capability:
            // everyone who reached this screen already has `manage_options`,
            // so it is not a permission question — it is that a merchant has
            // no use for the library entry behind their popup, and a control
            // they cannot act on is one they learn to ignore.
            'dev' => defined('WP_DEBUG') && WP_DEBUG,
            // **The consent link the admin draws, resolved here** (#77).
            // `PolicyLink::into()` runs on the published payload and on the
            // capture path, and neither is a path the admin reads — so every
            // preview, every gallery card and the creation flow's last step
            // rendered the fine print as "See our." while the front end
            // rendered it correctly, under a field labelled "leave empty for
            // your privacy policy".
            //
            // It travels as the site's URL rather than as a resolved tree, and
            // that is the whole of why it is here: the builder PATCHes the
            // config it was handed straight back, so an href resolved into a
            // config on the way out is an href stored on the way back —
            // frozen at publish, which is exactly what ADR 0032 refuses. The
            // admin resolves it at the render instead (`builder/policy.ts`).
            'policyUrl' => (string) get_privacy_policy_url(),
            // **Where the eligibility inspector opens.** The merchant does not
            // describe a URL — they visit one, because a `RequestContext`
            // cannot be built from a URL and must not be faked (ADR 0048). So
            // the list offers a door, and the door needs somewhere to start.
            //
            // The home URL rather than the parameter appended to it: the
            // dialog takes whichever page the merchant is asking about, and
            // this is only what its field is prefilled with. And it comes from
            // `home_url()` rather than from `location.origin`, so a
            // subdirectory install lands on the site rather than on the domain
            // root — which is the same `/blog/pricing` confusion half the real
            // Targeting tickets are about.
            'homeUrl' => (string) home_url('/'),
            'siteName' => wp_specialchars_decode((string) get_bloginfo('name'), ENT_QUOTES),
            'inspectParam' => InspectorEnqueue::PARAM,
            // WordPress owns site-wide layout. WConvert only names the native
            // editor this theme actually exposes, and only when the current
            // user may edit that layout. A classic theme with no registered
            // widget areas has nowhere useful for widgets.php to lead.
            'placementEditor' => self::placementEditor(),
            'timezone' => wp_timezone_string(),
            // **What one design may cost, so the builder can draw a meter.**
            // The same constant `LibraryLintTest` caps a shipped design at, sent
            // over rather than written a second time in TypeScript — a meter
            // measured against its own copy of the number is a meter that stays
            // green on the day the cap moves. Same reason `inspectParam` is
            // here, one line up.
            'designBudget' => DesignBudget::PER_DESIGN,
            // **What to call each paid tier**, read from `tiers.json` rather
            // than written into five components as the literal "Pro"
            // (ADR 0056). At launch every rung answers "Pro", so nothing on
            // screen changes — and splitting the range later is an edit to that
            // file rather than five strings and a release.
            'tiers' => $manifest->forTheAdmin(),
            // **Whether this install can run an A/B test**, resolved on the
            // server so no surface recombines two facts in an order of its own
            // (ADR 0026).
            //
            // ================================================================
            // THE RUNG IS READ OUT OF `tiers.json`, NOT WRITTEN DOWN HERE.
            // ================================================================
            // A/B testing is a MODULE — `pro/modules/ab-testing/` — so the
            // question *"which rung supplies it"* already has an answer in the
            // one file both the build and `WpProPresence` read. Naming
            // {@see Tier::Pro} here instead would be a second declaration of
            // the ladder, and moving the feature a rung would then be an edit
            // to `tiers.json` AND to this file — which is exactly the drift
            // ADR 0056 spells the ladder twice to avoid, with a parity test
            // between the two spellings.
            //
            // It never renders `unavailable`: nothing about the SITE makes a
            // test impossible, so this is `ready` or `locked` and the `locked`
            // card names {@see self::VARIANT_MODULE}'s rung.
            'variants' => self::whetherTestsCanRun($manifest, new WpProPresence($manifest)),
        ];
    }

    /**
     * The native WordPress surface that can place a block site-wide.
     *
     * @return array{type: 'site_editor'|'widgets', url: string}|null
     */
    private static function placementEditor(): ?array
    {
        if (!current_user_can('edit_theme_options')) {
            return null;
        }

        if (function_exists('wp_is_block_theme') && wp_is_block_theme()) {
            return ['type' => 'site_editor', 'url' => admin_url('site-editor.php')];
        }

        global $wp_registered_sidebars;

        if (is_array($wp_registered_sidebars) && $wp_registered_sidebars !== []) {
            return ['type' => 'widgets', 'url' => admin_url('widgets.php')];
        }

        return null;
    }

    /**
     * Whether a merchant on this install may start an A/B test, and what to
     * call the tier if not.
     *
     * **The absence of the routes is the actual enforcement** (ADR 0015): they
     * live in the `ab-testing` module's own PHP, so a build without the module
     * registers none of them and there is nothing to guard. This is what stops
     * the merchant meeting a control that will be refused, which is a separate
     * obligation and the one ADR 0042 names — *"never offer what will be
     * refused; mark it before the click, with the reason."*
     *
     * @return array{availability: string, tier: string|null}
     */
    private static function whetherTestsCanRun(TierManifest $manifest, ProPresence $pro): array
    {
        $tier = $manifest->lowestTierSupplying(self::VARIANT_MODULE);

        return [
            // `true` for the site half, always. A test needs no store, no WSMS
            // and no other plugin — so `unavailable` is unreachable here, and
            // `Availability::of()` is still what answers rather than a boolean
            // this file recombines (ADR 0026).
            'availability' => Availability::of(true, $tier !== null && $tier->isSuppliedBy($pro))->value,
            'tier' => $tier?->value,
        ];
    }
}

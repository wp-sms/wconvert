<?php

namespace WConvert\Admin;

use WConvert\Assets\ViteHelper;
use WConvert\Frontend\InspectorEnqueue;

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
    public const SLUG = 'wconvert';

    private const SCRIPT_HANDLE = 'wconvert-admin';

    private string $screenId = '';

    public function __construct(
        private readonly AdminNotices $notices,
    ) {
    }

    public function hooks(): void
    {
        add_action('admin_menu', [$this, 'registerMenu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueueAssets']);
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

        $settings = [
            // The CSV download is a navigation to `admin-post.php`, so the
            // screen needs the nonced URL rather than a REST path —
            // `apiFetch` would read the file into memory and then have to turn
            // it back into a download.
            'exportUrl' => LeadExport::url(),
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
            'inspectParam' => InspectorEnqueue::PARAM,
        ];

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
            'window.wconvertAdmin = ' . wp_json_encode($settings) . ';',
            'before'
        );
    }
}

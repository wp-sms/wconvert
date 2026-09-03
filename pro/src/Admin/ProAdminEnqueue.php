<?php

namespace WConvert\Pro\Admin;

use WConvert\Admin\AdminMenu;
use WConvert\Admin\AdminNotices;
use WConvert\Assets\ViteHelper;

defined('ABSPATH') || exit;

/**
 * =============================================================================
 * PRO REPLACES THE ADMIN BUNDLE TOO, ON ADR 0014'S RULE.
 * =============================================================================
 * ADR 0014 settled *"Pro replaces rather than augments"* for the front-end
 * loader, and every word of that argument is about two scripts on one page.
 * The admin has the same two scripts and had no answer, so it gets the same
 * one: Pro ships a COMPLETE replacement admin bundle — free's screens plus its
 * own, composed in Pro's entry where the bundler can see them — and dequeues
 * free's. One script tag, one React.
 *
 * WHY THE NORMAL ANSWER IS WRONG HERE. Two separately-installed plugins
 * usually force runtime injection: free's bundle boots, Pro's second script
 * finds free's app on the page and mounts extra screens into it. Neither
 * reference product faces the question — WP Statistics and WSMS both ship
 * premium as ONE BIGGER PLUGIN rather than a companion — so there is no
 * precedent to borrow, only the failure mode.
 *
 * That failure mode is ADR 0004's, unchanged: injection needs Pro's script to
 * run after free's app has mounted and before the merchant clicks anything,
 * which is a load-order contract across two tags on a page an optimiser may
 * reorder, aggregate and strip `defer` from. It needs free to grow a public
 * registration seam, which is a compatibility surface from the day it exists.
 * And it puts a second React one bundling mistake away — whose first
 * `useState` throws *"Invalid hook call"* against a copy that never rendered
 * it, blanking the screen with every test still green.
 *
 * **The swap below runs in PHP, on `admin_enqueue_scripts`, before one byte of
 * HTML exists**, so no optimiser ever sees two scripts to reorder.
 *
 * THE COST IS A SECOND COPY OF THE ADMIN APP IN PRO'S ZIP. Booked, not solved:
 * WP Statistics ships 3.3 MB per tier, and the admin bundle is downloaded by
 * one authenticated person on one screen. It carries no byte gate for exactly
 * that reason (ADR 0038).
 *
 * THERE IS NO ENTITLEMENT CHECK HERE, and nothing is missing. Being loaded IS
 * the entitlement (ADR 0015): this class is in Pro's ZIP and a free install has
 * never contained it.
 *
 * @since 0.1.0
 */
final class ProAdminEnqueue
{
    public const HANDLE = 'wconvert-pro-admin';

    /**
     * After free's, on the same hook.
     *
     * Derived from free's own constant rather than written as a number, so
     * "later" is a fact the two plugins share. It must not depend on load
     * order: WordPress loads active plugins in the order its own option lists
     * them, so a swap that worked because `wconvert-pro` happened to be read
     * after `wconvert` would work by accident.
     */
    public const PRIORITY = AdminMenu::PRIORITY + 10;

    /**
     * Pro's own bundle directory, spelled again rather than borrowed from free.
     *
     * That the two read identically is a coincidence of two Vite configs, not
     * a shared fact — the same reasoning {@see \WConvert\Pro\Frontend\ProLoaderEnqueue}
     * carries: each plugin's build decides where its own artifact lands, and
     * they release on independent tags (ADR 0030).
     */
    private const DIST = 'public/admin/';

    /** Where Pro's own catalogues live, relative to Pro's plugin directory. */
    private const LANGUAGES = 'resources/languages';

    /**
     * @param string $pluginDir Where Pro is on disk, trailing slash — `WCONVERT_PRO_DIR`.
     * @param string $pluginUrl Where Pro is on the web, trailing slash — `WCONVERT_PRO_URL`.
     */
    public function __construct(
        private readonly string $pluginDir,
        private readonly string $pluginUrl,
        private readonly AdminNotices $notices,
    ) {
    }

    public function hooks(): void
    {
        add_action('admin_enqueue_scripts', [$this, 'replace'], self::PRIORITY);
    }

    /**
     * Swap free's admin bundle for Pro's, on the screen that carries one.
     */
    public function replace(): void
    {
        // Free decides WHETHER this screen carries the admin bundle at all —
        // it matches on the hook suffix `add_menu_page()` returned, which is
        // its own and not Pro's to rebuild. Enqueuing unconditionally would put
        // 140 kB of React on every page of wp-admin.
        if (!wp_script_is(AdminMenu::SCRIPT_HANDLE, 'enqueued')) {
            return;
        }

        // ====================================================================
        // A BROKEN PRO DEGRADES TO FREE, NEVER TO NOTHING.
        // ====================================================================
        // An incomplete build — a ZIP that unpacked badly, a partial upload —
        // must not take the merchant's admin screen down with it. Dequeuing
        // free's bundle while pointing at one that is not there would render a
        // blank `<div>` with a 404 in a console nobody has open.
        //
        // So the dequeue is CONDITIONAL ON THE REPLACEMENT EXISTING, and the
        // order below is what makes that true rather than nearly true: Pro's
        // bundle is enqueued FIRST, and free's is only dequeued once that
        // returned true. `ViteHelper` checks both halves of the split build —
        // the entry and the builder chunk — so a Pro that shipped one and not
        // the other degrades here rather than on the merchant's fifth click.
        $enqueued = ViteHelper::enqueueAdminFrom(
            self::HANDLE,
            $this->pluginDir . self::DIST,
            $this->pluginUrl . self::DIST,
            // ================================================================
            // FREE'S DOMAIN ON THE HANDLE, PRO'S INLINED BESIDE IT.
            // ================================================================
            // Pro's bundle is free's screens plus Pro's, so it holds strings
            // from both catalogues — and `wp_set_script_translations()` binds
            // exactly ONE domain to a handle. Free's is the bound one because
            // it is almost all of the strings; Pro's arrives through
            // `setLocaleData` below.
            'wconvert',
            // Not free's notices object: free reports its OWN missing bundle
            // through that, and a Pro build that failed to unpack must not be
            // reported as free's plugin being broken. This class says what
            // actually happened, below.
            null
        );

        if (!$enqueued) {
            self::noticeMissingAdminBundle($this->notices);

            return;
        }

        ViteHelper::inlineTranslations(self::HANDLE, 'wconvert-pro', $this->pluginDir . self::LANGUAGES);

        // ====================================================================
        // THE SETTINGS TRAVEL WITH THE SCRIPT, BECAUSE THEY BELONG TO ONE.
        // ====================================================================
        // `wp_add_inline_script()` attaches to a HANDLE, so free's
        // `window.wconvertAdmin` goes when free's handle is deregistered
        // below. The SAME values are attached here rather than a second set
        // spelled out: free owns what the screen needs to know, and this is
        // Pro reaching into free, which is the one direction the split allows.
        wp_add_inline_script(
            self::HANDLE,
            'window.wconvertAdmin = ' . wp_json_encode(AdminMenu::settings()) . ';',
            'before'
        );

        wp_dequeue_script(AdminMenu::SCRIPT_HANDLE);
        // And DEREGISTERED, which is the difference between one bundle and
        // two: a dequeued script is out of the queue but still registered, and
        // WordPress prints the registered dependencies of anything queued. One
        // third-party script declaring `wconvert-admin` as a dependency would
        // put free's app back on a page that already has Pro's — two React
        // roots fighting over one mount node. Free's handle is not a
        // documented extension point and nothing in either plugin depends on
        // it (ADR 0014).
        wp_deregister_script(AdminMenu::SCRIPT_HANDLE);

        // The stylesheet goes with it. `ViteHelper` registers one per handle
        // and Pro's build emits its own, so leaving free's would load two
        // Tailwind sheets that differ only in which tree they were scanned
        // from — the later one winning by cascade rather than by decision.
        wp_dequeue_style(AdminMenu::SCRIPT_HANDLE);
        wp_deregister_style(AdminMenu::SCRIPT_HANDLE);
    }

    /**
     * **Through free's notices, not `admin_notices`.**
     *
     * This fires on exactly the screen whose `admin_notices` hook
     * {@see AdminNotices::suppress()} empties (ADR 0035), so a callback added
     * there would remove itself a moment later. Free prints its own from
     * inside the page, after the suppression, and that is the one path a
     * message about the admin screen can survive on — so Pro uses it too.
     *
     * A Pro that quietly does nothing is indistinguishable from a Pro that is
     * working, so the merchant reads the missing premium screens as a bug in
     * the product rather than as something they can fix — the same reasoning
     * as {@see \WConvert\Pro\Boot\BootGuard::noticeRefusal()}.
     */
    private static function noticeMissingAdminBundle(AdminNotices $notices): void
    {
        $notices->add(__(
            'WConvert Pro could not load its admin screen, so WConvert is showing you the free one. Everything you have already set up is still running. Reinstall WConvert Pro to restore it.',
            'wconvert-pro'
        ));
    }
}

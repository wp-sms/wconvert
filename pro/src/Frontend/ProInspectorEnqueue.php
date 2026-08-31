<?php

namespace WConvert\Pro\Frontend;

use WConvert\Assets\BuiltAsset;
use WConvert\Frontend\InspectorEnqueue;

defined('ABSPATH') || exit;

/**
 * =============================================================================
 * PRO REPLACES THE INSPECTOR TOO, AND THIS IS NOT OPTIONAL.
 * =============================================================================
 * The eligibility inspector reports the decision the page actually took, and
 * it does that by composing **the same module set** as the loader and calling
 * **the same `decide()`**. Pro replaces free's loader by dequeuing it
 * ({@see ProLoaderEnqueue}, ADR 0014) — so without this class a Pro install
 * would run Pro's loader beside FREE's inspector.
 *
 * The result would not be a slightly worse panel. Free's inspector has no
 * `exit_intent` module, so every exit-intent Optin on the site would be
 * reported as `inert` — *"it has no trigger this site can fire, so it can
 * never show"* — about Optins that are working perfectly. A diagnostic that is
 * confidently wrong is worse than no diagnostic at all, because the merchant
 * acts on it: they would go and rewrite rules that were correct.
 *
 * Everything else is {@see ProLoaderEnqueue}'s reasoning, unchanged: the swap
 * happens in PHP before one byte of HTML exists, there is no entitlement check
 * because being loaded IS the entitlement (ADR 0015), and a broken Pro
 * degrades to free rather than to nothing.
 *
 * @since 0.1.0
 */
final class ProInspectorEnqueue
{
    public const HANDLE = 'wconvert-pro-inspector';

    /**
     * After free's, on the same hook — derived rather than written as a
     * number, so "later" is a fact the two plugins share rather than two
     * numbers that agree by habit.
     */
    public const PRIORITY = InspectorEnqueue::PRIORITY + 10;

    /**
     * Pro's own bundle path, spelled again rather than borrowed from free.
     *
     * That the two read identically is a coincidence of two Vite configs, not
     * a shared fact — the same reasoning {@see ProLoaderEnqueue::DIST} carries.
     */
    private const DIST = 'public/inspector/inspector.js';

    /**
     * @param string $pluginDir Where Pro is on disk, trailing slash — `WCONVERT_PRO_DIR`.
     * @param string $pluginUrl Where Pro is on the web, trailing slash — `WCONVERT_PRO_URL`.
     */
    public function __construct(
        private readonly string $pluginDir,
        private readonly string $pluginUrl,
    ) {
    }

    public function hooks(): void
    {
        add_action('wp_enqueue_scripts', [$this, 'replace'], self::PRIORITY);
    }

    public function replace(): void
    {
        // Free decides WHETHER this page carries an inspector at all — the
        // capability check and the query parameter are its (ADR 0048), and
        // they are not Pro's to revisit. Enqueuing unconditionally here would
        // put the panel's bundle on every page of the site for everyone.
        if (!wp_script_is(InspectorEnqueue::HANDLE, 'enqueued')) {
            return;
        }

        $dist = $this->pluginDir . self::DIST;

        // A broken Pro degrades to free's inspector rather than to no panel.
        // Free's is wrong about premium Triggers, which is why this class
        // exists — but a merchant with no panel at all has nothing to be
        // wrong about and no way to tell why.
        if (!is_file($dist)) {
            return;
        }

        wp_dequeue_script(InspectorEnqueue::HANDLE);
        // And deregistered, for the reason the loader's swap gives: a dequeued
        // script is out of the queue but still registered, and WordPress
        // prints the registered dependencies of anything queued.
        wp_deregister_script(InspectorEnqueue::HANDLE);

        wp_enqueue_script(
            self::HANDLE,
            $this->pluginUrl . self::DIST,
            [],
            BuiltAsset::version($dist),
            true
        );
    }
}

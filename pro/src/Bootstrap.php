<?php

namespace WConvert\Pro;

use WConvert\Bootstrap as Core;
use WConvert\Pro\Boot\BootGuard;
use WConvert\Pro\Boot\PageCache;
use WConvert\Pro\Container\ProServiceProvider;
use WConvert\Pro\License\LicenseServiceProvider;

defined('ABSPATH') || exit;

/**
 * WConvert Pro bootstrap.
 *
 * @since 0.1.0
 */
final class Bootstrap
{
    private static bool $initialized = false;

    public static function init(): void
    {
        if (self::$initialized) {
            return;
        }

        self::$initialized = true;

        /*
         * ACTIVATION AND DEACTIVATION BOTH PURGE THE PAGE CACHE.
         *
         * Pro replaces free's loader and dequeues it, so turning Pro on or off
         * changes the `<script src>` on every already-cached page (ADR 0014).
         * These two moments are the whole trigger: a licence never gates a
         * feature (ADR 0015), so no licence change can alter what a cached page
         * should load, and none needs to purge it.
         *
         * Registered OUTSIDE the min-core guard below, deliberately. A Pro
         * that refuses to boot still changes nothing about what the pages
         * cached before it was activated should say — and a merchant
         * deactivating a Pro that never booted is exactly the person whose
         * cache should not be left holding a decision nobody made.
         */
        register_activation_hook(WCONVERT_PRO_MAIN_FILE, [PageCache::class, 'purge']);
        register_deactivation_hook(WCONVERT_PRO_MAIN_FILE, [PageCache::class, 'purge']);

        /*
         * Priority 20 — after free's own setup at 10, and NOT hooked to the
         * `wconvert_loaded` action free fires there. That action does not fire
         * when free is absent, which is precisely the case this guard exists to
         * report: hanging the guard off it would make "free is missing" the one
         * failure that stays silent.
         */
        add_action('plugins_loaded', [self::class, 'setup'], 20);
    }

    public static function setup(): void
    {
        $verdict = BootGuard::verdict();

        if (!$verdict->mayBoot()) {
            BootGuard::noticeRefusal($verdict);

            return;
        }

        /*
         * Defined only past the guard, so WConvert\Support\ProPresence reads a
         * Pro that refused to boot exactly as it reads a Pro that is not
         * installed — which is what the merchant is in fact getting.
         */
        define('WCONVERT_PRO_LOADED', true);

        add_action('init', [self::class, 'loadTextdomain']);

        /*
         * Pro's services bind into the container FREE created rather than
         * standing up a second one (ADR 0015).
         *
         * Two providers, registered and then booted, as free's Bootstrap does.
         * Both run at `plugins_loaded` priority 20 — after every free provider
         * has registered and booted — so neither phase has an ordering left to
         * fix inside free; the split is for Pro's own two, which share nothing
         * today and should not start depending on the order they are listed in.
         *
         * The licence's provider is the second and is deliberately its own
         * (ADR 0143): it supplies updates and support, never a feature, and
         * keeping it out of ProServiceProvider is what lets
         * `NoLicenceOnTheFrontEndTest` name the one directory it may live in.
         */
        $container = Core::container();

        $providers = [new ProServiceProvider(), new LicenseServiceProvider()];

        foreach ($providers as $provider) {
            $provider->register($container);
        }

        foreach ($providers as $provider) {
            $provider->boot($container);
        }

        /**
         * Fires once WConvert Pro is fully loaded.
         *
         * @since 0.1.0
         */
        do_action('wconvert_pro_loaded');
    }

    /**
     * Pro carries its own text domain, kept out of free's .pot.
     */
    public static function loadTextdomain(): void
    {
        load_plugin_textdomain(
            'wconvert-pro',
            false,
            dirname(plugin_basename(WCONVERT_PRO_MAIN_FILE)) . '/resources/languages'
        );
    }
}

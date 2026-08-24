<?php

namespace WConvert\Pro;

use WConvert\Pro\Boot\BootGuard;

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
         * Pro registers no features yet, and there is deliberately no provider
         * loop or container accessor standing ready for them. When the premium
         * capabilities land they bind into the container FREE created —
         * WConvert\Bootstrap::container() — rather than standing up a second
         * one (ADR 0015). Each arrives with the wiring it needs; nothing is
         * written before its subject (ADR 0029).
         */

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

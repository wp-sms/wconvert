<?php

namespace WConvert\Pro\Container;

use WConvert\Container\ServiceContainer;
use WConvert\Container\ServiceProvider;
use WConvert\Pro\Frontend\ProLoaderEnqueue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * Pro's services, bound into the container FREE created.
 *
 * There is one container on the site and Pro binds into it rather than
 * standing up a second (ADR 0015), which is why this implements free's
 * {@see ServiceProvider} interface and why `WConvert\Bootstrap::container()`
 * is public. The dependency runs one way, as everywhere else in this split:
 * Pro reaches into free, free never reaches into Pro.
 *
 * It is Pro's FIRST provider, and it arrives with the first thing that needs
 * one. Nothing is written before its subject (ADR 0029), so there is still no
 * provider loop here — a second provider gets one, and until then a loop would
 * be scaffolding around a list of one.
 *
 * @since 0.1.0
 */
final class ProServiceProvider implements ServiceProvider
{
    public function register(ServiceContainer $container): void
    {
        // Where Pro is on disk and on the web, passed rather than read off the
        // constants inside — the same shape free's LoaderEnqueue takes, and
        // what lets `tests/unit/Pro/Frontend/LoaderReplacementTest.php` point
        // the replacement at a tree it controls.
        $container->register(
            ProLoaderEnqueue::class,
            static fn (): ProLoaderEnqueue => new ProLoaderEnqueue(WCONVERT_PRO_DIR, WCONVERT_PRO_URL)
        );
    }

    public function boot(ServiceContainer $container): void
    {
        /*
         * ====================================================================
         * PRO REGISTERS THE PREMIUM RULE TYPES. THAT REGISTRATION IS THE
         * ENTITLEMENT.
         * ====================================================================
         * Free's degradation resolver strips a rule the install cannot
         * evaluate on its way to the page (ADR 0012), and what it asks is a
         * set-membership test against `SuppliedRules` — never "is Pro loaded".
         * This line is what puts `exit_intent`, `scroll_up`, `click_element`
         * and the premium Conditions in that set, so an install without Pro
         * substitutes or suspends and an install with it changes nothing.
         *
         * Pro names none of them: it asks the ONE manifest both plugins read
         * for the types filed under its own tier, exactly as free does for
         * hers. The premium split still adds zero new lists (ADR 0015).
         *
         * ABOVE the `is_admin()` guard below, and that is not an oversight.
         * The builder's rule rows and the Optin list's [[Suspended]] state are
         * admin screens that ask the same question, and a registry that was
         * only correct on the front end would tell a Pro customer their Optins
         * are suspended while the site shows them perfectly.
         */
        $container->resolve(SuppliedRules::class)->add(
            ...$container->resolve(RuleVocabulary::class)->typesAt(Tier::Pro)
        );

        // The same guard free's loader sits behind, and for the same reason:
        // wp-admin is not a page a visitor is looking at. There is deliberately
        // no SECOND condition here — no licence, no entitlement, no "is Pro
        // loaded". This code running IS the answer to that question (ADR 0015),
        // which is what "not one premium feature needs an `if`" means in
        // practice.
        if (is_admin()) {
            return;
        }

        $container->resolve(ProLoaderEnqueue::class)->hooks();
    }
}

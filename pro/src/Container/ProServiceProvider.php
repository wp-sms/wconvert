<?php

namespace WConvert\Pro\Container;

use WConvert\Container\ServiceContainer;
use WConvert\Container\ServiceProvider;
use WConvert\Pro\Frontend\ProLoaderEnqueue;

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

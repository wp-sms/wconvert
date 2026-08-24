<?php

namespace WConvert\Container;

use WConvert\Support\ProPresence;

defined('ABSPATH') || exit;

/**
 * Core services — the ones every request may need, admin or front end.
 *
 * @since 0.1.0
 */
final class CoreServiceProvider implements ServiceProvider
{
    public function register(ServiceContainer $container): void
    {
        $container->register(ProPresence::class, static fn (): ProPresence => new ProPresence());
    }

    public function boot(ServiceContainer $container): void
    {
    }
}

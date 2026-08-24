<?php

namespace WConvert\Container;

use WConvert\Admin\AdminMenu;

defined('ABSPATH') || exit;

/**
 * Services used only inside wp-admin.
 *
 * @since 0.1.0
 */
final class AdminServiceProvider implements ServiceProvider
{
    public function register(ServiceContainer $container): void
    {
        $container->register(AdminMenu::class, static fn (): AdminMenu => new AdminMenu());
    }

    public function boot(ServiceContainer $container): void
    {
        if (!is_admin()) {
            return;
        }

        $container->resolve(AdminMenu::class)->hooks();
    }
}

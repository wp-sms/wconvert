<?php

namespace WConvert\Container;

use WConvert\Admin\AdminMenu;
use WConvert\Admin\LeadExport;
use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;

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

        // The CSV download is an `admin-post.php` action rather than a REST
        // route: a download is a navigation, and the browser has to be handed
        // a `Content-Disposition` it can act on.
        $container->register(
            LeadExport::class,
            static fn (ServiceContainer $c): LeadExport => new LeadExport(
                $c->resolve(LeadRepository::class),
                $c->resolve(OptinRepository::class),
                $c->resolve(LeadCsv::class)
            )
        );
    }

    public function boot(ServiceContainer $container): void
    {
        if (!is_admin()) {
            return;
        }

        $container->resolve(AdminMenu::class)->hooks();
        $container->resolve(LeadExport::class)->hooks();
    }
}

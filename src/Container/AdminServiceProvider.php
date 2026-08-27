<?php

namespace WConvert\Container;

use WConvert\Admin\AdminMenu;
use WConvert\Admin\AdminNotices;
use WConvert\Admin\LeadExport;
use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;

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

        // Empties `admin_notices` on WConvert's screens and carries the
        // plugin's own notices across the gap that leaves (ADR 0035). It reads
        // the published set only once the loader bundle is already known to be
        // missing, which is why it can afford to ask on every admin page.
        $container->register(
            AdminNotices::class,
            static fn (ServiceContainer $c): AdminNotices => new AdminNotices(
                $c->resolve(PublishedSet::class)
            )
        );

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

        $container->resolve(AdminNotices::class)->hooks();
        $container->resolve(AdminMenu::class)->hooks();
        $container->resolve(LeadExport::class)->hooks();
    }
}

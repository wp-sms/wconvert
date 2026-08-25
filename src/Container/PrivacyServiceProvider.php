<?php

namespace WConvert\Container;

use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Privacy\LeadEraser;
use WConvert\Privacy\LeadExporter;
use WConvert\Privacy\PolicyText;
use WConvert\Retention\LeadPruner;
use WConvert\Retention\RetentionPeriod;

defined('ABSPATH') || exit;

/**
 * The personal-data surface: the exporter, the eraser, the suggested
 * privacy-policy text, and the retention pruning job.
 *
 * **All four boot on every request, admin or not.** The exporter and eraser
 * are filters WordPress applies inside its own privacy tools, so registering
 * them behind `is_admin()` would work today and break the moment those tools
 * are driven by WP-CLI or by a cron request. The pruner has to be registered
 * wherever WP-Cron fires, which is a front-end request more often than not.
 *
 * WSMS's `src/Container/PrivacyServiceProvider.php` is the shape this copies —
 * five exporters, six erasers and a policy-text registration (ADR 0018) —
 * minus its priority-99 eraser ordering, which is a hazard WConvert does not
 * have. One eraser over one table has nothing to be ordered against.
 *
 * @since 0.1.0
 */
final class PrivacyServiceProvider implements ServiceProvider
{
    public function register(ServiceContainer $container): void
    {
        $container->register(
            LeadExporter::class,
            static fn (ServiceContainer $c): LeadExporter => new LeadExporter(
                $c->resolve(LeadRepository::class),
                $c->resolve(OptinRepository::class)
            )
        );

        $container->register(
            LeadEraser::class,
            static fn (ServiceContainer $c): LeadEraser => new LeadEraser($c->resolve(LeadRepository::class))
        );

        $container->register(
            PolicyText::class,
            static fn (ServiceContainer $c): PolicyText => new PolicyText($c->resolve(RetentionPeriod::class))
        );

        $container->register(
            LeadPruner::class,
            static fn (ServiceContainer $c): LeadPruner => new LeadPruner(
                $c->resolve(LeadRepository::class),
                $c->resolve(RetentionPeriod::class)
            )
        );
    }

    public function boot(ServiceContainer $container): void
    {
        $container->resolve(LeadExporter::class)->hooks();
        $container->resolve(LeadEraser::class)->hooks();
        $container->resolve(LeadPruner::class)->hooks();

        // `admin_init` rather than now: the suggestion is only ever read by
        // the policy editor, and composing it means reading the retention
        // option — which is not autoloaded, so doing it here would put a
        // database query on every uncached front-end page load, the exact harm
        // ADR 0003 names.
        add_action('admin_init', static function () use ($container): void {
            $container->resolve(PolicyText::class)->register();
        });
    }
}

<?php

namespace WConvert\Container;

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Frontend\LoaderEnqueue;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\OptinController;
use WConvert\Rest\TemplateController;
use WConvert\Rules\RuleVocabulary;
use WConvert\Storage\OptionStore;
use WConvert\Storage\WpOptionStore;
use WConvert\Support\ProPresence;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

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

        $container->register(Connection::class, static fn (): Connection => new WpdbConnection());

        // PHP reads the rule manifest at runtime (ADR 0005). Once, here — the
        // file is small but it is still a file, and the alternative is every
        // publish paying a decode.
        $container->register(RuleVocabulary::class, static fn (): RuleVocabulary => RuleVocabulary::fromManifest());
        // The template vocabulary, read the same way and for the same reason:
        // once per request, so a save does not pay a decode (ADR 0010).
        $container->register(
            TemplateVocabulary::class,
            static fn (): TemplateVocabulary => TemplateVocabulary::fromManifest()
        );

        $container->register(
            TemplateLibrary::class,
            static fn (ServiceContainer $c): TemplateLibrary => TemplateLibrary::fromDirectory(
                $c->resolve(TemplateVocabulary::class)
            )
        );

        $container->register(OptionStore::class, static fn (): OptionStore => new WpOptionStore());

        $container->register(
            Installer::class,
            static fn (ServiceContainer $c): Installer => new Installer($c->resolve(OptionStore::class))
        );

        $container->register(
            PublishedSet::class,
            static fn (ServiceContainer $c): PublishedSet => new PublishedSet($c->resolve(OptionStore::class))
        );

        $container->register(
            OptinRepository::class,
            static fn (ServiceContainer $c): OptinRepository => new OptinRepository(
                $c->resolve(Connection::class),
                $c->resolve(PublishedSet::class),
                $c->resolve(RuleVocabulary::class)
            )
        );

        $container->register(
            LoaderEnqueue::class,
            static fn (ServiceContainer $c): LoaderEnqueue => new LoaderEnqueue($c->resolve(PublishedSet::class))
        );

        $container->register(
            OptinController::class,
            static fn (ServiceContainer $c): OptinController => new OptinController(
                $c->resolve(OptinRepository::class),
                $c->resolve(RuleVocabulary::class),
                $c->resolve(TemplateVocabulary::class),
                $c->resolve(TemplateLibrary::class)
            )
        );

        $container->register(
            TemplateController::class,
            static fn (ServiceContainer $c): TemplateController => new TemplateController(
                $c->resolve(TemplateLibrary::class)
            )
        );
    }

    public function boot(ServiceContainer $container): void
    {
        // A plugin updated by overwriting its directory never fires an
        // activation hook, so the schema has to be able to catch up somewhere
        // other than activation.
        //
        // That somewhere is `admin_init`, and NOT this boot. The version
        // option is written with autoload=false like everything else WConvert
        // stores, so reading it here would put a real database query on every
        // uncached front-end page load — which is the exact harm ADR 0003
        // names when it rejects a transient under the payload. WordPress's own
        // upgrade routines run on `admin_init` for the same reason, and any
        // admin page load repairs the schema before a merchant can reach a
        // screen that needs it.
        add_action('admin_init', static function () use ($container): void {
            $container->resolve(Installer::class)->upgradeIfNeeded();
        });

        $container->resolve(OptinController::class)->hooks();
        $container->resolve(TemplateController::class)->hooks();

        if (!is_admin()) {
            $container->resolve(LoaderEnqueue::class)->hooks();
        }
    }
}

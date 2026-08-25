<?php

namespace WConvert\Container;

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Frontend\LoaderEnqueue;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Rest\CaptureController;
use WConvert\Rest\LeadController;
use WConvert\Rest\OptinController;
use WConvert\Rest\TemplateController;
use WConvert\Retention\RetentionPeriod;
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
            LeadRepository::class,
            static fn (ServiceContainer $c): LeadRepository => new LeadRepository($c->resolve(Connection::class))
        );

        $container->register(
            LeadCapture::class,
            static fn (ServiceContainer $c): LeadCapture => new LeadCapture($c->resolve(LeadRepository::class))
        );

        $container->register(
            LeadLog::class,
            static fn (ServiceContainer $c): LeadLog => new LeadLog($c->resolve(LeadRepository::class))
        );

        // The CSV's columns come from the template vocabulary rather than from
        // the rows, so the header can be written before the first Lead is
        // fetched — which is what makes a streamed export possible at all.
        $container->register(
            LeadCsv::class,
            static fn (ServiceContainer $c): LeadCsv => new LeadCsv($c->resolve(TemplateVocabulary::class))
        );

        // Retention lives in one non-autoloaded option, not a column
        // (ADR 0018). Registered here rather than beside the pruner because
        // the REST settings route reads it too.
        $container->register(
            RetentionPeriod::class,
            static fn (ServiceContainer $c): RetentionPeriod => new RetentionPeriod($c->resolve(OptionStore::class))
        );

        $container->register(
            LeadController::class,
            static fn (ServiceContainer $c): LeadController => new LeadController(
                $c->resolve(LeadLog::class),
                $c->resolve(RetentionPeriod::class)
            )
        );

        $container->register(
            CaptureController::class,
            static fn (ServiceContainer $c): CaptureController => new CaptureController(
                $c->resolve(PublishedSet::class),
                $c->resolve(LeadCapture::class),
                $c->resolve(TemplateVocabulary::class)
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
        // Registered on every request, admin included, and NOT behind the
        // `is_admin()` guard the loader sits behind. A REST route has to exist
        // wherever `rest_api_init` fires or it does not exist at all — and the
        // visitor posting a capture is on a page WordPress may serve through
        // any entry point.
        $container->resolve(CaptureController::class)->hooks();
        $container->resolve(LeadController::class)->hooks();

        if (!is_admin()) {
            $container->resolve(LoaderEnqueue::class)->hooks();
        }
    }
}

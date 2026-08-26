<?php

namespace WConvert\Container;

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Destination\BulkRePush;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\PushWorker;
use WConvert\Destination\Wsms\WpWsmsContacts;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Frontend\LoaderEnqueue;
use WConvert\Goal\GoalRegistry;
use WConvert\Lead\LeadCapture;
use WConvert\Lead\LeadCsv;
use WConvert\Lead\LeadLog;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Queue\ActionSchedulerQueue;
use WConvert\Queue\Queue;
use WConvert\Rest\BeaconController;
use WConvert\Rest\CaptureController;
use WConvert\Rest\DashboardController;
use WConvert\Rest\DestinationController;
use WConvert\Rest\GoalController;
use WConvert\Rest\LeadController;
use WConvert\Rest\OptinController;
use WConvert\Rest\PlaybookController;
use WConvert\Rest\RateLimit;
use WConvert\Rest\RuleController;
use WConvert\Rest\TemplateController;
use WConvert\Rest\ThemeController;
use WConvert\Retention\RetentionPeriod;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatsRepository;
use WConvert\Storage\OptionStore;
use WConvert\Storage\TransientStore;
use WConvert\Storage\WpOptionStore;
use WConvert\Storage\WpTransientStore;
use WConvert\Support\ProPresence;
use WConvert\Support\SitePresence;
use WConvert\Support\Tier;
use WConvert\Support\WpProPresence;
use WConvert\Support\WpSitePresence;
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
        $container->register(ProPresence::class, static fn (): ProPresence => new WpProPresence());
        // Beside it rather than folded into it: a missing tier is buyable
        // from us and a missing plugin is not, and collapsing the two shows a
        // Pro customer an advertisement for Pro (ADR 0026).
        $container->register(SitePresence::class, static fn (): SitePresence => new WpSitePresence());

        $container->register(Connection::class, static fn (): Connection => new WpdbConnection());

        // PHP reads the rule manifest at runtime (ADR 0005). Once, here — the
        // file is small but it is still a file, and the alternative is every
        // publish paying a decode.
        $container->register(RuleVocabulary::class, static fn (): RuleVocabulary => RuleVocabulary::fromManifest());

        // **The live registry: which client rule types this install can
        // actually evaluate.** Free registers the manifest's own free tier;
        // [[Pro]] adds the premium ones from its provider, into this same
        // object, exactly as it does with the Destination registry — so the
        // question the enqueue path asks is answered by which code ran rather
        // than by a licence or a tier (ADR 0015). Neither side names a rule
        // type: each asks the one manifest for its own, so the premium split
        // still adds zero new lists.
        $container->register(
            SuppliedRules::class,
            static fn (ServiceContainer $c): SuppliedRules => (new SuppliedRules())
                ->add(...$c->resolve(RuleVocabulary::class)->typesAt(
                    Tier::Free,
                    // The SITE half, asked at registration rather than at the
                    // resolver: a rule needing a store on a site with no store
                    // cannot be evaluated, so registering it would make an
                    // Optin holding it fail silently instead of being visibly
                    // [[Suspended]] (ADR 0027). Nothing free ships declares
                    // one, so this call is vacuous today — but a gate only
                    // Pro's provider applied is a gate free's would re-open.
                    $c->resolve(SitePresence::class)
                ))
        );

        // The thin resolver of ADR 0012, shared by both of its call sites —
        // [[Playbook]] prefill and asset enqueue. One object, so the two
        // cannot read the substitution table differently.
        $container->register(
            Degradation::class,
            static fn (ServiceContainer $c): Degradation => new Degradation(
                $c->resolve(RuleVocabulary::class),
                $c->resolve(SuppliedRules::class)
            )
        );
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
        // Beside the option store rather than folded into it: what goes
        // here is a value whose whole meaning is that it expires, which is
        // the opposite of the derived state ADR 0003 refuses to put in a
        // transient.
        $container->register(TransientStore::class, static fn (): TransientStore => new WpTransientStore());

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
            static fn (ServiceContainer $c): LoaderEnqueue => new LoaderEnqueue(
                $c->resolve(PublishedSet::class),
                $c->resolve(Degradation::class)
            )
        );

        // The Goal registry is an enum plus the two facts that resolve its
        // Availability, so there is nothing to read off disk and nothing to
        // cache (ADR 0019's fifth refusal).
        $container->register(
            GoalRegistry::class,
            static fn (ServiceContainer $c): GoalRegistry => new GoalRegistry(
                $c->resolve(ProPresence::class),
                $c->resolve(SitePresence::class)
            )
        );

        // Bundled Playbooks are PHP files returning arrays, read once here for
        // the same reason the two manifests are — the alternative is every
        // request that touches the gallery paying for the directory
        // (ADR 0013). Validation happens on the way in, and only here.
        $container->register(
            PlaybookLibrary::class,
            static fn (ServiceContainer $c): PlaybookLibrary => PlaybookLibrary::fromDirectory(
                $c->resolve(TemplateLibrary::class),
                $c->resolve(TemplateVocabulary::class),
                $c->resolve(RuleVocabulary::class)
            )
        );

        $container->register(
            Prefill::class,
            static fn (ServiceContainer $c): Prefill => new Prefill(
                $c->resolve(PlaybookLibrary::class),
                $c->resolve(TemplateLibrary::class),
                $c->resolve(TemplateVocabulary::class),
                $c->resolve(Degradation::class)
            )
        );

        $container->register(
            OptinController::class,
            static fn (ServiceContainer $c): OptinController => new OptinController(
                $c->resolve(OptinRepository::class),
                $c->resolve(RuleVocabulary::class),
                $c->resolve(TemplateVocabulary::class),
                $c->resolve(TemplateLibrary::class),
                $c->resolve(GoalRegistry::class),
                $c->resolve(PublishedSet::class),
                $c->resolve(Degradation::class),
                $c->resolve(RuleCatalogue::class)
            )
        );

        $container->register(
            GoalController::class,
            static fn (ServiceContainer $c): GoalController => new GoalController(
                $c->resolve(GoalRegistry::class)
            )
        );

        $container->register(
            PlaybookController::class,
            static fn (ServiceContainer $c): PlaybookController => new PlaybookController(
                $c->resolve(PlaybookLibrary::class),
                $c->resolve(GoalRegistry::class),
                $c->resolve(Prefill::class)
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

        // ------------------------------------------------------------------
        // Destinations, the queue, and health (#30).
        // ------------------------------------------------------------------

        $container->register(Queue::class, static fn (): Queue => new ActionSchedulerQueue());

        $container->register(
            DestinationStore::class,
            static fn (ServiceContainer $c): DestinationStore => new DestinationStore($c->resolve(OptionStore::class))
        );
        $container->register(
            ConnectionStore::class,
            static fn (ServiceContainer $c): ConnectionStore => new ConnectionStore($c->resolve(OptionStore::class))
        );

        // Health in its OWN option, separate from the configuration above.
        // Two jobs completing at once lose an increment to `update_option`'s
        // read-modify-write, and that race is tolerable for advisory health —
        // it would not be tolerable if it ate an admin's edit (ADR 0008).
        $container->register(
            HealthStore::class,
            static fn (ServiceContainer $c): HealthStore => new HealthStore($c->resolve(OptionStore::class))
        );
        $container->register(
            DeliveryFailures::class,
            static fn (ServiceContainer $c): DeliveryFailures => new DeliveryFailures($c->resolve(OptionStore::class))
        );

        // **Pro registers its own types into this same registry** from its
        // service provider's boot(), by pulling it out of the shared container
        // (ADR 0015). Free registers the WSMS push and nothing else — every
        // Destination that makes an outbound HTTP call is Pro's (#4).
        $container->register(
            DestinationRegistry::class,
            static fn (ServiceContainer $c): DestinationRegistry => (new DestinationRegistry(
                $c->resolve(ProPresence::class),
                $c->resolve(SitePresence::class)
            ))->register(new WsmsDestinationType(new WpWsmsContacts()))
        );

        $container->register(
            PushDispatcher::class,
            static fn (ServiceContainer $c): PushDispatcher => new PushDispatcher(
                $c->resolve(DestinationRegistry::class),
                $c->resolve(DestinationStore::class),
                $c->resolve(OptinRepository::class),
                $c->resolve(HealthStore::class),
                $c->resolve(Queue::class)
            )
        );

        $container->register(
            PushWorker::class,
            static fn (ServiceContainer $c): PushWorker => new PushWorker(
                $c->resolve(DestinationRegistry::class),
                $c->resolve(DestinationStore::class),
                $c->resolve(ConnectionStore::class),
                $c->resolve(LeadRepository::class),
                $c->resolve(OptinRepository::class),
                $c->resolve(HealthStore::class),
                $c->resolve(DeliveryFailures::class),
                $c->resolve(Queue::class)
            )
        );

        $container->register(
            BulkRePush::class,
            static fn (ServiceContainer $c): BulkRePush => new BulkRePush(
                $c->resolve(DestinationRegistry::class),
                $c->resolve(DestinationStore::class),
                $c->resolve(OptinRepository::class),
                $c->resolve(LeadRepository::class),
                $c->resolve(HealthStore::class),
                $c->resolve(Queue::class)
            )
        );

        $container->register(
            DestinationController::class,
            static fn (ServiceContainer $c): DestinationController => new DestinationController(
                $c->resolve(DestinationRegistry::class),
                $c->resolve(DestinationStore::class),
                $c->resolve(ConnectionStore::class),
                $c->resolve(HealthStore::class),
                $c->resolve(DeliveryFailures::class),
                $c->resolve(BulkRePush::class)
            )
        );

        $container->register(
            StatsRepository::class,
            static fn (ServiceContainer $c): StatsRepository => new StatsRepository($c->resolve(Connection::class))
        );

        // The analytics screen. It reads `wconvert_stats` and interprets it
        // through `wconvert_optins`, and the two tables meet in PHP rather
        // than in a JOIN — which is why it takes two repositories and not a
        // widened Connection (ADR 0034).
        $container->register(
            Dashboard::class,
            static fn (ServiceContainer $c): Dashboard => new Dashboard(
                $c->resolve(StatsRepository::class),
                $c->resolve(OptinRepository::class)
            )
        );

        $container->register(
            DashboardController::class,
            static fn (ServiceContainer $c): DashboardController => new DashboardController(
                $c->resolve(Dashboard::class)
            )
        );

        $container->register(
            RateLimit::class,
            static fn (ServiceContainer $c): RateLimit => new RateLimit($c->resolve(TransientStore::class))
        );

        $container->register(
            BeaconController::class,
            static fn (ServiceContainer $c): BeaconController => new BeaconController(
                $c->resolve(PublishedSet::class),
                $c->resolve(StatsRepository::class),
                $c->resolve(RateLimit::class),
                $c->resolve(Degradation::class)
            )
        );

        $container->register(
            TemplateController::class,
            static fn (ServiceContainer $c): TemplateController => new TemplateController(
                $c->resolve(TemplateLibrary::class)
            )
        );

        // The rule vocabulary as the builder needs it: the manifest, plus the
        // words PHP holds so `make-pot` can see them and the [[Availability]]
        // only this install can resolve (ADR 0026).
        $container->register(
            RuleCatalogue::class,
            static fn (ServiceContainer $c): RuleCatalogue => new RuleCatalogue(
                $c->resolve(RuleVocabulary::class),
                $c->resolve(ProPresence::class),
                $c->resolve(SitePresence::class)
            )
        );

        $container->register(
            RuleController::class,
            static fn (ServiceContainer $c): RuleController => new RuleController($c->resolve(RuleCatalogue::class))
        );

        // Theme inheritance is an opt-in VALUE COPY, so this reads the site's
        // palette and nothing stores where a token came from.
        $container->register(ThemeController::class, static fn (): ThemeController => new ThemeController());
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
        $container->resolve(RuleController::class)->hooks();
        $container->resolve(ThemeController::class)->hooks();
        $container->resolve(GoalController::class)->hooks();
        $container->resolve(PlaybookController::class)->hooks();
        // Registered on every request, admin included, and NOT behind the
        // `is_admin()` guard the loader sits behind. A REST route has to exist
        // wherever `rest_api_init` fires or it does not exist at all — and the
        // visitor posting a capture is on a page WordPress may serve through
        // any entry point.
        $container->resolve(CaptureController::class)->hooks();
        // And the beacon, for the same reason: a route has to exist
        // wherever `rest_api_init` fires or it does not exist at all.
        $container->resolve(BeaconController::class)->hooks();
        $container->resolve(LeadController::class)->hooks();
        $container->resolve(DashboardController::class)->hooks();
        $container->resolve(DestinationController::class)->hooks();

        // On EVERY request, admin included, and not behind `is_admin()`. The
        // dispatch attaches to a capture, which arrives through REST from a
        // visitor's page; the worker attaches to an Action Scheduler hook,
        // which fires from a loopback request that is neither (#4).
        $container->resolve(PushDispatcher::class)->hooks();
        $container->resolve(PushWorker::class)->hooks();

        if (!is_admin()) {
            $container->resolve(LoaderEnqueue::class)->hooks();
        }
    }
}

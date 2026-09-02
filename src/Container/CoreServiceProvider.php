<?php

namespace WConvert\Container;

/*
 * ABOVE the imports, and in this one file only.
 *
 * Every other file in src/ carries this line directly below its `use` block,
 * which is the house order and stays that way. This provider imports fifty-nine
 * classes, so the guard landed on line 65 — and wp.org's Plugin Check reads the
 * FIRST FIFTY LINES for it (`Direct_File_Access_Check::has_direct_access_protection_regex()`).
 * Its AST pass would find the guard anywhere in the file but never runs on a
 * namespaced one: it walks only top-level nodes, and under `namespace Foo;`
 * every statement is nested one level down. So the regex is the only pass that
 * sees this file, the fifty-line window is real, and the guard was reported
 * missing on a file that has always had one (#60).
 *
 * Nothing between the namespace and here can execute, so this is the earliest
 * the line can sit and the ONE position no import list can push out of view.
 */
defined('ABSPATH') || exit;

use WConvert\Database\Connection;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Destination\BulkRePush;
use WConvert\Destination\ConnectionStore;
use WConvert\Destination\DeliveryFailures;
use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationStore;
use WConvert\Destination\HealthStore;
use WConvert\Destination\LeadMagnet\DeliveryCount;
use WConvert\Destination\LeadMagnet\LeadMagnetDestinationType;
use WConvert\Destination\LeadMagnet\WpMailer;
use WConvert\Destination\MailPoet\MailPoetDestinationType;
use WConvert\Destination\MailPoet\WpMailPoetSubscribers;
use WConvert\Destination\PushDispatcher;
use WConvert\Destination\PushWorker;
use WConvert\Destination\Wsms\WpWsmsContacts;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Frontend\InlineOptinBlock;
use WConvert\Frontend\InlineOptinShortcode;
use WConvert\Frontend\InspectorEnqueue;
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
use WConvert\Rest\RestController;
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

/**
 * Core services — the ones every request may need, admin or front end.
 *
 * @since 0.1.0
 */
final class CoreServiceProvider implements ServiceProvider
{
    /**
     * Every controller that owns REST routes.
     *
     * A list rather than eleven lines in {@see self::boot()} because it is a
     * list that has to be COMPLETE: a controller left off it registers no
     * route at all, and a route that does not exist fails as a 404 from the
     * admin screen that calls it rather than as anything naming the omission.
     * `tests/unit/Container/NothingTranslatesAtBootTest.php` walks `src/Rest`
     * and fails on a {@see RestController} that is not named here.
     *
     * @var list<class-string<RestController>>
     */
    public const REST_CONTROLLERS = [
        OptinController::class,
        TemplateController::class,
        RuleController::class,
        ThemeController::class,
        GoalController::class,
        PlaybookController::class,
        CaptureController::class,
        BeaconController::class,
        LeadController::class,
        DashboardController::class,
        DestinationController::class,
    ];

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

        // **Below the repository, and it takes one.** Installing is no longer
        // only DDL: an upgrade rebuilds the published set, because that option
        // is the one piece of derived state nothing rewrites on its own and a
        // projection shape change would otherwise reach no existing site
        // (ADR 0003). Registration order does not matter to the container —
        // these are lazy factories — but reading order does, and the
        // dependency is the point of the change.
        $container->register(
            Installer::class,
            static fn (ServiceContainer $c): Installer => new Installer(
                $c->resolve(OptionStore::class),
                $c->resolve(OptinRepository::class)
            )
        );

        $container->register(
            LoaderEnqueue::class,
            static fn (ServiceContainer $c): LoaderEnqueue => new LoaderEnqueue(
                $c->resolve(PublishedSet::class),
                $c->resolve(Degradation::class)
            )
        );

        // The eligibility inspector, which runs on the REAL page — a merchant
        // does not describe a URL, they visit it. Registered beside the loader
        // because it is the same front-end read path with one more question
        // asked of it, and it prints nothing at all unless an administrator
        // asked (ADR 0048).
        $container->register(
            InspectorEnqueue::class,
            static fn (ServiceContainer $c): InspectorEnqueue => new InspectorEnqueue(
                $c->resolve(OptinRepository::class),
                $c->resolve(PublishedSet::class),
                $c->resolve(Degradation::class),
                $c->resolve(RuleCatalogue::class)
            )
        );

        // The two authoring surfaces for an `inline` Optin. The block reads
        // the published set and the Optins' names to build its picker; the
        // shortcode takes an id and needs nothing at all, and is registered
        // here anyway so that both are wired in one place and neither can be
        // added without the other being noticed.
        $container->register(
            InlineOptinBlock::class,
            static fn (ServiceContainer $c): InlineOptinBlock => new InlineOptinBlock(
                $c->resolve(PublishedSet::class),
                $c->resolve(OptinRepository::class)
            )
        );

        $container->register(
            InlineOptinShortcode::class,
            static fn (): InlineOptinShortcode => new InlineOptinShortcode()
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
        // (ADR 0015). Free registers three types and **every one of them is
        // in-process** — every Destination that makes an outbound HTTP call is
        // Pro's (#4, ADR 0007). WSMS and MailPoet are sibling plugins in this
        // process reading this database; `wp_mail()` is WordPress's own.
        $container->register(
            DestinationRegistry::class,
            static fn (ServiceContainer $c): DestinationRegistry => (new DestinationRegistry(
                $c->resolve(ProPresence::class),
                $c->resolve(SitePresence::class)
            ))
                ->register(new WsmsDestinationType(new WpWsmsContacts()))
                // The third in-process type, and the one that gives
                // `Goal::GrowEmailList` somewhere to put an address on a site
                // with no WP SMS — which is what that Goal claims to do (#87).
                ->register(new MailPoetDestinationType(new WpMailPoetSubscribers()))
                // The one type that works on a Standalone install: `wp_mail()`
                // is WordPress's, so it needs nothing and is never
                // `unavailable` (ADR 0007, ADR 0026).
                ->register(new LeadMagnetDestinationType(new WpMailer()))
        );

        $container->register(
            DeliveryCount::class,
            static fn (ServiceContainer $c): DeliveryCount => new DeliveryCount(
                $c->resolve(OptinRepository::class),
                $c->resolve(StatsRepository::class)
            )
        );

        $container->register(
            PushDispatcher::class,
            static fn (ServiceContainer $c): PushDispatcher => new PushDispatcher(
                $c->resolve(DestinationRegistry::class),
                $c->resolve(DestinationStore::class),
                $c->resolve(OptinRepository::class),
                $c->resolve(HealthStore::class),
                $c->resolve(Queue::class),
                $c->resolve(ConnectionStore::class)
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
                $c->resolve(Queue::class),
                $c->resolve(DeliveryCount::class)
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
                $c->resolve(BulkRePush::class),
                // The *Test* buttons run through the same dispatcher a capture
                // does, so a test exercises the real `push()` rather than a
                // second path that would prove itself and nothing else (#88).
                $c->resolve(PushDispatcher::class)
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
                $c->resolve(TemplateLibrary::class),
                $c->resolve(TemplateVocabulary::class),
                $c->resolve(ProPresence::class)
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

        /*
         * ====================================================================
         * THE SITE'S TIMEZONE CHANGED, SO EVERY SCHEDULE MEANS A DIFFERENT
         * INSTANT NOW.
         * ====================================================================
         * An [[Optin]]'s window is STORED as the local wall time the merchant
         * typed and RESOLVED against `wp_timezone()` when the published set is
         * built (ADR 0050) — which is what makes correcting a wrong site
         * timezone correct every schedule with it, rather than leaving them
         * all an hour out forever.
         *
         * That only works if something rebuilds. The set is rebuilt on WRITE
         * and never on a timer (ADR 0003), and a timezone change is not a
         * write to any Optin, so without this the correction lands on the next
         * unrelated publish — which may be never. This is the one event other
         * than an Optin write that changes what the projection would produce.
         *
         * Both options, because WordPress writes both when a merchant picks a
         * zone: a named zone sets `timezone_string` and blanks `gmt_offset`,
         * and a bare UTC offset does the reverse.
         *
         * **Both rebuild, and a settings save therefore rebuilds twice.** That
         * is deliberate rather than overlooked. The obvious saving — a flag
         * that lets the first one through and skips the second — is a
         * REQUEST-scoped flag on a callback registered once per request, so it
         * skips every timezone change after the first for the life of the
         * process. `bin/verify-schedule.php` caught exactly that, on a real
         * WordPress, changing the zone twice: the second change silently did
         * nothing and the set stayed on the first zone. WordPress fires these
         * only when the value actually changed, so the price is one extra
         * rebuild on the rare occasion a merchant edits Options → General.
         */
        $reresolve = static function () use ($container): void {
            $container->resolve(OptinRepository::class)->rebuildForTimezoneChange();
        };

        add_action('update_option_timezone_string', $reresolve);
        add_action('update_option_gmt_offset', $reresolve);

        /*
         * ====================================================================
         * A REST CONTROLLER IS BUILT WHEN A ROUTE IS SERVED, NEVER HERE.
         * ====================================================================
         * This runs on `plugins_loaded`, which is before `init` — and a
         * controller is not one object but the graph behind it.
         * `PlaybookController` pulls the [[Playbook]] library, which `require`s
         * seven PHP files whose every string is wrapped in `__()` (ADR 0013).
         * Fifty-seven translations asked for before the text domain is loaded,
         * on EVERY request, which is #52: WordPress answers with
         * `_load_textdomain_just_in_time was called incorrectly` and prints it
         * mid-`plugins_loaded`, so output begins before `<!DOCTYPE html>` and
         * nothing after it can set a header. The quieter half is that the
         * strings do not come back translated, because they were asked for
         * before there was a domain to translate them against.
         *
         * **Nothing is lost by waiting**, and that is what makes this the fix
         * rather than a deferral bought with something. A controller's entire
         * `hooks()` was one `add_action('rest_api_init', …)`, so it already
         * did nothing until a route was served; what boot paid for was
         * building the graph behind routes most requests never reach.
         *
         * One deferral covers all eleven, and covers whatever a controller's
         * dependencies come to do at construction next — which is the half
         * that a fix aimed at the Playbook library alone would leave open for
         * the next constructor that reaches for a word.
         *
         * NOT behind `is_admin()`, for the reason the two public routes always
         * needed: a route has to exist wherever `rest_api_init` fires or it
         * does not exist at all, and the visitor posting a capture or a beacon
         * is on a page WordPress may serve through any entry point.
         */
        add_action('rest_api_init', static function () use ($container): void {
            foreach (self::REST_CONTROLLERS as $controller) {
                $container->resolve($controller)->registerRoutes();
            }
        });

        /*
         * ====================================================================
         * THE TWO WAYS AN `inline` OPTIN IS PLACED ON A PAGE.
         * ====================================================================
         * `inline` is the one [[Display Type]] that is not an overlay: it
         * renders where it was embedded and never competes for the screen, so
         * unlike the other three it needs somewhere on the page to go. These
         * two are the only things in the plugin that write one
         * ({@see \WConvert\Frontend\InlineAnchor}).
         *
         * ON `init`, AND NOT BEHIND `is_admin()`. Both halves are load-bearing
         * and for different reasons:
         *
         * - `init`, because `register_block_type()` translates `block.json`'s
         *   title through the i18n schema, and this method runs on
         *   `plugins_loaded`. Registering there is #52 again — fifty-seven
         *   translations before there is a domain to translate against, and
         *   `_load_textdomain_just_in_time` printed before `<!DOCTYPE html>`.
         *
         * - Both sides, because each surface needs a side the other does not.
         *   The block's editor script is enqueued in wp-admin and its
         *   `render_callback` runs on the visitor's page; the shortcode is
         *   parsed on the front end and, in the classic editor, has to exist
         *   in wp-admin for anything to know the tag is taken.
         *
         * Resolved inside the callback rather than here, for the reason the
         * REST controllers are: `plugins_loaded` is not the moment to build a
         * graph nothing has asked for yet.
         */
        add_action('init', static function () use ($container): void {
            $container->resolve(InlineOptinBlock::class)->register();
            $container->resolve(InlineOptinShortcode::class)->register();
        });

        // On EVERY request, admin included, and not behind `is_admin()`. The
        // dispatch attaches to a capture, which arrives through REST from a
        // visitor's page; the worker attaches to an Action Scheduler hook,
        // which fires from a loopback request that is neither (#4).
        $container->resolve(PushDispatcher::class)->hooks();
        $container->resolve(PushWorker::class)->hooks();

        if (!is_admin()) {
            $container->resolve(LoaderEnqueue::class)->hooks();
            // Beside the loader, because it is the same front-end read path
            // with one more question asked of it. WHEN it runs relative to the
            // loader is `InspectorEnqueue::PRIORITY`'s to state and is not
            // restated here — this comment said "and after it" for one commit
            // after that constant became `- 1`, which is how a duplicated
            // fact goes stale. It costs an ordinary page view one capability
            // check and one `isset($_GET[...])`.
            $container->resolve(InspectorEnqueue::class)->hooks();
        }
    }
}

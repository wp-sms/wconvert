<?php

namespace WConvert;

use WConvert\Container\AdminServiceProvider;
use WConvert\Container\AgentServiceProvider;
use WConvert\Container\CoreServiceProvider;
use WConvert\Container\PrivacyServiceProvider;
use WConvert\Container\ServiceContainer;
use WConvert\Database\Installer;
use WConvert\Database\WpdbConnection;
use WConvert\Milestone\MilestoneStore;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishedSet;
use WConvert\Retention\LeadPruner;
use WConvert\Rules\RuleVocabulary;
use WConvert\Storage\WpOptionStore;

defined('ABSPATH') || exit;

/**
 * WConvert plugin bootstrap.
 *
 * Creates the service container, registers lifecycle hooks and wires the
 * service providers on `plugins_loaded`.
 *
 * The container this creates is SHARED: Pro binds its own services into the
 * same instance rather than standing one up of its own (ADR 0015). That is why
 * `container()` is public and why `wconvert_loaded` fires once every free
 * provider has booted — it is the hook Pro attaches to.
 *
 * @since 0.1.0
 */
final class Bootstrap
{
    /** @var bool Whether the plugin has already been initialised. */
    private static bool $initialized = false;

    /** @var ServiceContainer|null Cached container instance. */
    private static ?ServiceContainer $container = null;

    /** @var list<class-string<\WConvert\Container\ServiceProvider>> Service providers, in registration order. */
    private const PROVIDERS = [
        CoreServiceProvider::class,
        PrivacyServiceProvider::class,
        AdminServiceProvider::class,
        AgentServiceProvider::class,
    ];

    /**
     * Entry point — called once from the main plugin file.
     */
    public static function init(): void
    {
        if (self::$initialized) {
            return;
        }

        self::$initialized = true;

        // Activation creates the tables. It is not the only path that can —
        // an automatic update overwrites the directory without ever
        // deactivating — so CoreServiceProvider carries a version check too.
        register_activation_hook(WCONVERT_MAIN_FILE, [self::class, 'activate']);

        // Deactivation does NOT drop the tables — a merchant turning the
        // plugin off has not asked for their [[Lead]]s to be destroyed, and
        // that is the whole posture of ADR 0018. It does clear the schedule,
        // because a cron event whose callback no longer exists is a WP-Cron
        // entry WordPress retries forever against nothing.
        register_deactivation_hook(WCONVERT_MAIN_FILE, [self::class, 'deactivate']);

        add_action('plugins_loaded', [self::class, 'setup'], 10);
    }

    /**
     * Run on `plugins_loaded` — boots services and announces that free is up.
     *
     * No `load_plugin_textdomain()`: translations come from wp.org language
     * packs, which WordPress loads just in time for the `wconvert` domain.
     */
    public static function setup(): void
    {
        self::initializeServices();

        /**
         * Fires once WConvert core is fully loaded.
         *
         * Pro hooks here. Third-party code may too.
         *
         * @since 0.1.0
         */
        do_action('wconvert_loaded');
    }

    /**
     * Create WConvert's tables, and rebuild the derived state that depends on
     * them.
     *
     * Runs before `plugins_loaded`, so it builds what it needs by hand rather
     * than reaching for a container that does not exist yet. The graph is
     * spelled out because it has to be: {@see Installer} rebuilds the
     * published set now, which means it needs the repository, which needs the
     * connection, the option store and the rule manifest. Four lines that
     * duplicate {@see \WConvert\Container\CoreServiceProvider}'s factories is
     * the price of the hook firing this early, and it is cheaper than teaching
     * activation to boot a container.
     *
     * ========================================================================
     * NETWORK ACTIVATION IS REFUSED.
     * ========================================================================
     * **Multisite is out of scope for v1.** Network-activating would install
     * tables for whichever site's `$wpdb->prefix` is current and for no other,
     * so a site nobody had opened the admin of would serve campaigns with no
     * tables under them. The WordPress.org review (October 2026) flagged that,
     * so activation now stops with a message instead, before WordPress records
     * the plugin as network-active. Activating on each site works as before.
     *
     * Full support is ~20-30 lines when it is wanted: loop `get_sites()` here,
     * hook `wp_initialize_site` for sites created later (**not**
     * `wpmu_new_blog`, deprecated since WP 5.1), and teach `uninstall.php` the
     * same loop.
     */
    public static function activate(bool $networkWide = false): void
    {
        if ($networkWide && is_multisite()) {
            wp_die(
                esc_html__('WConvert cannot be activated for the whole network. Activate it on each site instead, from that site\'s Plugins screen.', 'wconvert'),
                esc_html__('Plugin not activated', 'wconvert'),
                ['back_link' => true]
            );
        }

        $options = new WpOptionStore();

        (new Installer($options, new OptinRepository(
            new WpdbConnection(),
            new PublishedSet($options),
            RuleVocabulary::fromManifest(),
            new MilestoneStore($options)
        )))->install();

        // Deactivation clears the product-activity pruner; retained rows still
        // need it, whether or not a product module comes back.
        if (\WConvert\Stats\ProductStats::tracked() && !wp_next_scheduled(\WConvert\Stats\ProductStats::HOOK)) {
            wp_schedule_single_event(time() + DAY_IN_SECONDS, \WConvert\Stats\ProductStats::HOOK);
        }
    }

    /**
     * Turn the plugin off without touching a merchant's data.
     *
     * The retention period stays in its option, so re-activating restores the
     * setting rather than silently reverting to keep-forever.
     *
     * Every WP-Cron event goes, because each would otherwise fire into a hook
     * nobody is listening on: the pruner, the recovery sweep (re-scheduled on
     * the next boot), the import cleanup — cleared by hook rather than by
     * arguments, because it is scheduled once per administrator — and the
     * product-activity pruner, which activate() re-schedules while retained
     * product rows may exist. Queued
     * Action Scheduler deliveries stay: they are a [[Lead]] on its way to a
     * [[Destination]], and re-activating sends them.
     */
    public static function deactivate(): void
    {
        wp_clear_scheduled_hook(LeadPruner::HOOK);
        wp_clear_scheduled_hook(\WConvert\Destination\SubmissionDispatcher::RECOVER);
        wp_unschedule_hook(\WConvert\Rest\TemplateTransferController::CLEANUP);
        wp_clear_scheduled_hook(\WConvert\Stats\ProductStats::HOOK);
    }

    /**
     * Return the shared service container (created on first call).
     */
    public static function container(): ServiceContainer
    {
        if (self::$container === null) {
            self::$container = ServiceContainer::getInstance();
        }

        return self::$container;
    }

    /**
     * Register every provider, then boot every provider.
     *
     * The two phases are separate so a provider's `boot()` may resolve a
     * service another provider registered, whatever the order above.
     */
    private static function initializeServices(): void
    {
        $container = self::container();

        /** @var list<\WConvert\Container\ServiceProvider> $providers */
        $providers = [];

        foreach (self::PROVIDERS as $providerClass) {
            $provider = new $providerClass();
            $provider->register($container);
            $providers[] = $provider;
        }

        foreach ($providers as $provider) {
            $provider->boot($container);
        }
    }
}

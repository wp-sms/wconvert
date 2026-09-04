<?php

namespace WConvert;

use WConvert\Container\AdminServiceProvider;
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
     * Run on `plugins_loaded` — loads the text domain, boots services and
     * announces that free is up.
     */
    public static function setup(): void
    {
        add_action('init', [self::class, 'loadTextdomain']);

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
     * `$networkWide` IS ACCEPTED AND DELIBERATELY NOT ACTED ON.
     * ========================================================================
     * **Multisite is out of scope for v1**, and this argument is where that
     * decision has to be visible, because ignoring a parameter you never named
     * is indistinguishable from not knowing it exists.
     *
     * Network-activating installs tables for whichever site's `$wpdb->prefix`
     * is current and for no other. The rest are not left broken forever —
     * {@see \WConvert\Storage\OptionStore} reads per-site options and
     * `admin_init` fires per site, so a site whose `wconvert_db_version` is
     * missing installs on its first dashboard visit. What that does not cover
     * is a site **nobody has opened the admin of**, whose front end is live and
     * has no tables under it, and there is no missing-table guard anywhere in
     * the capture path.
     *
     * So the failure mode is not "it breaks", it is "it works on the sites you
     * looked at" — which is worse than either honest alternative, and is
     * addressed by saying so rather than by half-fixing it:
     * {@see \WConvert\Admin\AdminNotices::warnAboutNetworkActivation()} tells
     * a network administrator on the screen where they did it, and
     * `readme.txt` says it before they install.
     *
     * The full job is ~20-30 lines — loop `get_sites()` here, and hook
     * `wp_initialize_site` for sites created later (**not** `wpmu_new_blog`,
     * deprecated since WP 5.1 and still the one most tutorials show) — and
     * nothing in this decision makes it harder to do in 1.2, once there is
     * evidence anyone wants it.
     */
    public static function activate(bool $networkWide = false): void
    {
        $options = new WpOptionStore();

        (new Installer($options, new OptinRepository(
            new WpdbConnection(),
            new PublishedSet($options),
            RuleVocabulary::fromManifest(),
    new MilestoneStore($options)
        )))->install();
    }

    /**
     * Turn the plugin off without touching a merchant's data.
     *
     * The retention period stays in its option, so re-activating restores the
     * setting rather than silently reverting to keep-forever.
     */
    public static function deactivate(): void
    {
        wp_clear_scheduled_hook(LeadPruner::HOOK);
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

    /**
     * Load the plugin text domain.
     *
     * Translations are not bundled — WordPress delivers them into
     * wp-content/languages/plugins/ for the wconvert slug, and
     * load_plugin_textdomain() checks that global directory first.
     */
    public static function loadTextdomain(): void
    {
        load_plugin_textdomain(
            'wconvert',
            false,
            dirname(plugin_basename(WCONVERT_MAIN_FILE)) . '/resources/languages'
        );
    }
}

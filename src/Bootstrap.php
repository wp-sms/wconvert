<?php

namespace WConvert;

use WConvert\Container\AdminServiceProvider;
use WConvert\Container\CoreServiceProvider;
use WConvert\Container\ServiceContainer;
use WConvert\Database\Installer;
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
     * Create WConvert's tables.
     *
     * Runs before `plugins_loaded`, so it builds what it needs by hand rather
     * than reaching for a container that does not exist yet.
     */
    public static function activate(): void
    {
        (new Installer(new WpOptionStore()))->install();
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

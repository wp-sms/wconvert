<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * What the site has, asked of WordPress.
 *
 * Possession rather than configuration, exactly as {@see WpProPresence} reads
 * Pro: the question is whether the code is loaded, not whether it is set up.
 * A store with no products is still a store, and a merchant who deactivates
 * WooCommerce reads here as a site that never had one — which is what
 * ADR 0027 makes self-healing rather than a repair step.
 *
 * `class_exists()` rather than `is_plugin_active()`: the latter lives in an
 * admin-only file, reads an option, and answers "activated" where what matters
 * is "loaded" — a plugin activated but fatally erroring is a plugin whose
 * features are absent.
 *
 * @since 0.1.0
 */
final class WpSitePresence implements SitePresence
{
    /**
     * What each dependency is present as, once WordPress has loaded it.
     *
     * A `match` rather than the `const` array this was, and the reason is that
     * the array could not be COMPILED on the oldest PHP the plugin supports:
     * `SiteDependency::WooCommerce->value` is a property fetch, and a property
     * fetch in a constant expression needs PHP 8.3. On 8.1 and 8.2 — and the
     * plugin file says `Requires PHP: 8.1` — merely autoloading this class was
     * `Constant expression contains invalid operations`, a fatal on every
     * front-end request, because the loader's degradation resolver asks what
     * the site has. Found by the class sweep in
     * `tests/unit/Container/NothingTranslatesAtBootTest.php`, which is the
     * first thing in the suite to load every class in `src/`; PHPStan cannot
     * see it because it is a limit of the compiler rather than of the types.
     *
     * The `match` is the better shape anyway. A new case added to the enum is
     * an `UnhandledMatchError` naming it, where the array was an undefined key
     * and a `class_exists(null)` two lines later.
     */
    public function has(SiteDependency $dependency): bool
    {
        $class = match ($dependency) {
            SiteDependency::WooCommerce => 'WooCommerce',
            // WSMS's own bootstrap, which is what "WP SMS is loaded" means. Its
            // container is what the push reaches through, so the class that OWNS
            // the container is the honest thing to ask about — a plugin whose
            // files are present but which fataled before booting has no container
            // to hand out.
            SiteDependency::Wsms => 'WSms\\Bootstrap',
            // MailPoet's own container wrapper, for the same reason: it is the
            // class that owns the container the push reaches through, and
            // `mailpoet_initializer.php` calls `getInstance()` on it while the
            // plugin file is still loading. A MailPoet whose files are present
            // but whose requirements check bailed never touches it, which is
            // the honest answer — its API is not there to call.
            SiteDependency::MailPoet => 'MailPoet\\DI\\ContainerWrapper',
        };

        return class_exists($class, false);
    }
}

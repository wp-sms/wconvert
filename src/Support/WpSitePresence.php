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
    /** What each dependency is present as, once WordPress has loaded it. */
    private const CLASSES = [
        SiteDependency::WooCommerce->value => 'WooCommerce',
    ];

    public function has(SiteDependency $dependency): bool
    {
        return class_exists(self::CLASSES[$dependency->value], false);
    }
}

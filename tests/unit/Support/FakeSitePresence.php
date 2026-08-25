<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Support\SiteDependency;
use WConvert\Support\SitePresence;

/**
 * What the site has, decided by the test — the unit suite has no WordPress to
 * ask, and no WooCommerce to load.
 */
final class FakeSitePresence implements SitePresence
{
    /**
     * @param list<SiteDependency> $present
     */
    public function __construct(private readonly array $present = [])
    {
    }

    public function has(SiteDependency $dependency): bool
    {
        return in_array($dependency, $this->present, true);
    }
}

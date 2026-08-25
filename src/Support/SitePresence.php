<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Whether the site has something a registry member depends on.
 *
 * Beside {@see ProPresence} rather than folded into it, because the two
 * answers mean different things and the difference is the whole of ADR 0026: a
 * missing tier is buyable from us and a missing plugin is not.
 *
 * An interface for the same reason ProPresence is one — the answer is a fact
 * about the running install that the unit suite has no install to supply.
 *
 * @since 0.1.0
 */
interface SitePresence
{
    public function has(SiteDependency $dependency): bool;
}

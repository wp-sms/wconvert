<?php

namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

/**
 * Pro's paid download transport (ADR 0156). Free has no implementation, so a
 * free install can never request premium JSON. Installed content never calls it.
 */
interface CatalogPremiumTransport
{
    /**
     * One pass for a batch of premium objects — a setup and its design, or up
     * to fifty designs — so one install is one authorization, not one per file.
     *
     * @param list<string> $designs digests of premium design objects
     * @param list<string> $setups digests of premium setup objects
     */
    public function authorize(array $designs, array $setups): void;

    /** A premium object or image covered by the current pass. */
    public function premium(string $path, int $limit): string;
}

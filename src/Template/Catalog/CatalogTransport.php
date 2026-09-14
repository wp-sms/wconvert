<?php

namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

interface CatalogTransport
{
    /** Returns a bounded JSON response or throws a useful catalog-local error. */
    public function get(string $url): string;
}

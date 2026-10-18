<?php
namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

/** Optional paid download transport. Installed content never calls it. */
interface CatalogPackTransport
{
    public function pack(string $url, string $digest): string;
}

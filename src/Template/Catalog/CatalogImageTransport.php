<?php
namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

interface CatalogImageTransport
{
    /** Returns bytes bounded to the declared size; redirects are forbidden. */
    public function image(string $url, int $bytes): string;
}

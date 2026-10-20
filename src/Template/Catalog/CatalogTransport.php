<?php

namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

interface CatalogTransport
{
    /** Returns a bounded JSON response or throws a useful catalog-local error. */
    public function get(string $url, int $limit = PackValidator::MAX_BYTES): string;

    /**
     * A conditional GET for the one mutable object, the pointer.
     *
     * @return array{body: string, etag: string|null}|null null when the server answered 304
     */
    public function revalidate(string $url, ?string $etag): ?array;
}

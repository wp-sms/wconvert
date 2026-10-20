<?php

namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

interface CatalogTransport
{
    /** Seconds one request may take when the caller has no tighter budget. */
    public const TIMEOUT = 15;

    /**
     * Returns a bounded JSON response or throws a useful catalog-local error.
     * `$timeout` is what is left of the caller's budget, so a refresh never
     * outlives its twenty seconds by a whole request.
     */
    public function get(string $url, int $limit = PackValidator::MAX_BYTES, int $timeout = self::TIMEOUT): string;

    /**
     * A conditional GET for the one mutable object, the pointer.
     *
     * @return array{body: string, etag: string|null}|null null when the server answered 304
     */
    public function revalidate(string $url, ?string $etag): ?array;
}

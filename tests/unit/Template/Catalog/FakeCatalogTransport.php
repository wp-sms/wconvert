<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use RuntimeException;
use WConvert\Template\Catalog\CatalogImageTransport;
use WConvert\Template\Catalog\CatalogTransport;

/** A v3 catalogue service in memory, including the pointer's ETag. */
class FakeCatalogTransport implements CatalogTransport, CatalogImageTransport
{
    /** @var array<string, string> */
    public array $responses = [];
    /** @var array<string, string> */
    public array $etags = [];
    /** @var list<string> */
    public array $requests = [];

    /** @var list<int> */
    public array $timeouts = [];

    public function get(string $url, int $limit = 262144, int $timeout = self::TIMEOUT): string
    {
        $this->requests[] = $url;
        $this->timeouts[] = $timeout;
        $body = $this->responses[$url] ?? throw new RuntimeException('Offline');
        if (strlen($body) > $limit) throw new RuntimeException('The catalog response is too large.');
        return $body;
    }

    public function revalidate(string $url, ?string $etag): ?array
    {
        $this->requests[] = $url . ($etag !== null ? ' (If-None-Match)' : '');
        $body = $this->responses[$url] ?? throw new RuntimeException('Offline');
        if ($etag !== null && $etag === ($this->etags[$url] ?? null)) return null;
        return ['body' => $body, 'etag' => $this->etags[$url] ?? null];
    }

    public function image(string $url, int $bytes): string
    {
        return $this->get($url, $bytes);
    }
}

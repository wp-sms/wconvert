<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Catalog\CatalogTransport;
use WConvert\Template\Catalog\DiscoveryRelease;

final class DiscoveryReleaseTest extends TestCase
{
    /** @return array<string, mixed> */
    private function read(string $page, string $release = ''): array
    {
        $release = $release ?: str_repeat('a', 64);
        $transport = new class($page) implements CatalogTransport {
            public function __construct(private readonly string $page) {}
            public function get(string $url): string { return $this->page; }
        };
        return DiscoveryRelease::read(['schema' => 2, 'release' => $release, 'pages' => [['url' => 'https://catalog.example/page.json', 'sha256' => hash('sha256', $page)]]], 'https://catalog.example/index.json', $transport);
    }

    public function testConsistentImmutableReleaseReturnsMetadataWithoutNetworkSideEffects(): void
    {
        $result = $this->read(json_encode(['schema' => 2, 'release' => str_repeat('a', 64), 'packs' => [], 'collections' => []], JSON_THROW_ON_ERROR));
        $this->assertSame([], $result['packs']); $this->assertSame(str_repeat('a', 64), $result['release']);
    }

    public function testMixedReleaseIsRejectedEvenWhenPageDigestMatches(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->read(json_encode(['schema' => 2, 'release' => str_repeat('b', 64), 'packs' => [], 'collections' => []], JSON_THROW_ON_ERROR));
    }

    public function testUnknownVersionsAndOtherOriginsFailClosed(): void
    {
        $this->expectException(\RuntimeException::class); DiscoveryRelease::sameOrigin('https://catalog.example/index', 'https://catalog.example@evil.example/page');
    }

    public function testInvalidOrUnreferencedCollectionMembersAreRejected(): void
    {
        $collection = ['id' => 'sale', 'revision' => str_repeat('a', 64), 'name' => 'Sale', 'description' => 'Sale ideas', 'cover' => 'sale', 'priority' => 1, 'business_types' => ['stores'], 'markets' => [], 'items' => [['pack_id' => 'store', 'pack_digest' => str_repeat('a', 64), 'setup_id' => 'early-access', 'stage' => 'before']]];
        $this->expectException(\RuntimeException::class); $this->read(json_encode(['schema' => 2, 'release' => str_repeat('a', 64), 'packs' => [], 'collections' => [$collection]], JSON_THROW_ON_ERROR));
    }
}

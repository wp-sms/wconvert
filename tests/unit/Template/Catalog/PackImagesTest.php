<?php
namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Catalog\{CatalogTransport, CatalogImageTransport, InstalledPacks, PackValidator, TemplateCatalog, VerifiedAssets};
use WConvert\Tests\Unit\Support\FakeOptionStore;

final class PackImagesTest extends TestCase
{
    private string $directory;
    private const IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=';
    protected function setUp(): void { $this->directory = sys_get_temp_dir() . '/wconvert-media-flow-' . bin2hex(random_bytes(8)); }
    protected function tearDown(): void
    {
        if (!is_dir($this->directory)) return;
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($this->directory);
    }
    /** @return array<string, mixed> */
    private function pack(string $version = '1.0.0'): array
    {
        $entry = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true);
        $entry['tree']['steps'][0]['content']['children'][] = ['type' => 'image', 'id' => 'n99', 'src' => '', 'alt' => 'A plant'];
        $image = base64_decode(self::IMAGE);
        return ['schema' => 2, 'id' => 'illustrated', 'name' => 'Illustrated', 'description' => 'Test images.', 'version' => $version,
            'requires' => ['plugin' => '0.1.0', 'tree' => 2, 'capabilities' => ['template-tree:2', 'capture-journey:1', 'pack-images:1']],
            'assets' => [['id' => 'plant', 'sha256' => hash('sha256', $image), 'mime' => 'image/png', 'bytes' => strlen($image), 'width' => 1, 'height' => 1, 'access' => 'free']],
            'image_bindings' => [['template_id' => $entry['id'], 'node_id' => 'n99', 'asset_id' => 'plant']], 'templates' => [$entry]];
    }
    public function testPreviewInstallOfflineRepairAndUpdateKeepExactLocalImages(): void
    {
        $http = new class implements CatalogTransport, CatalogImageTransport {
            public string $pack; public string $bytes; public int $images = 0;
            public function get(string $url): string
            {
                if (str_ends_with($url, '/pack.json')) return $this->pack;
                $pack = json_decode($this->pack, true);
                return json_encode(['schema' => 1, 'packs' => [[...array_intersect_key($pack, array_flip(['id', 'name', 'version', 'description'])), 'url' => 'https://catalog.example/pack.json', 'sha256' => hash('sha256', $this->pack)]]], JSON_THROW_ON_ERROR);
            }
            public function image(string $url, int $bytes): string
            {
                $this->images++;
                TestCase::assertSame('https://catalog.example/assets/free/' . hash('sha256', $this->bytes) . '.png', $url);
                TestCase::assertSame(strlen($this->bytes), $bytes);
                return $this->bytes;
            }
        };
        $http->pack = json_encode($this->pack(), JSON_THROW_ON_ERROR); $http->bytes = base64_decode(self::IMAGE);
        $validator = PackValidator::shipping();
        $assets = new VerifiedAssets($this->directory . '/images', 'https://site.example/local-images');
        $installed = new InstalledPacks($this->directory . '/packs', $validator, $assets);
        $options = new FakeOptionStore(); $options->set(TemplateCatalog::SOURCE_OPTION, 'https://catalog.example/index.json');
        $catalog = new TemplateCatalog($options, $http, $validator, $installed);
        $catalog->refresh(); $preview = $catalog->preview('illustrated');
        self::assertCount(0, $installed->entries(), 'Preview caches images but does not install templates');
        $catalog->install('illustrated', $preview['digest']);
        self::assertSame($preview, $catalog->preview('illustrated', true));
        self::assertSame(1, $http->images);
        self::assertSame($http->pack, file_get_contents($this->directory . '/packs/' . $preview['digest'] . '.json'), 'Raw archive identity is not rewritten');
        $before = $installed->entries()[0];
        self::assertStringContainsString('https://site.example/local-images/free/', json_encode($before, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
        $http->pack = json_encode($this->pack('1.1.0'), JSON_THROW_ON_ERROR);
        $catalog->refresh(); $next = $catalog->preview('illustrated'); $catalog->install('illustrated', $next['digest']);
        self::assertSame(1, $http->images, 'Unchanged image reused across releases');
        self::assertSame($before['tree'], $installed->entries()[1]['tree']);
        $path = $this->directory . '/images/free/' . hash('sha256', $http->bytes) . '.png';
        file_put_contents($path, 'damaged'); clearstatcache();
        $fresh = new InstalledPacks($this->directory . '/packs', $validator, $assets);
        self::assertSame([], $fresh->entries(), 'Incomplete image sets do not become usable');
        $catalog->preview('illustrated');
        self::assertSame(2, $http->images, 'Explicit preview repairs the cache');
        self::assertCount(2, (new InstalledPacks($this->directory . '/packs', $validator, $assets))->entries());
    }
    public function testMissingAndInvalidBindingsCannotBeInstalled(): void
    {
        $validator = PackValidator::shipping();
        foreach (['missing', 'duplicate', 'not-image', 'external', 'premium', 'undeclared', 'unused'] as $case) {
            $pack = $this->pack();
            if ($case === 'missing') $pack['image_bindings'][0]['asset_id'] = 'missing';
            if ($case === 'duplicate') $pack['image_bindings'][] = $pack['image_bindings'][0];
            if ($case === 'not-image') $pack['image_bindings'][0]['node_id'] = 'n1';
            if ($case === 'external') $pack['assets'][0]['url'] = 'https://tracker.example/pixel';
            if ($case === 'premium') $pack['assets'][0]['access'] = 'premium';
            if ($case === 'undeclared') array_pop($pack['requires']['capabilities']);
            if ($case === 'unused') $pack['image_bindings'] = [];
            try { $validator->decode(json_encode($pack, JSON_THROW_ON_ERROR)); self::fail('Accepted ' . $case); }
            catch (\RuntimeException $error) { self::assertNotSame('', $error->getMessage()); }
        }
        $installed = new InstalledPacks($this->directory . '/packs', $validator, new VerifiedAssets($this->directory . '/images', 'https://site.example/images'));
        try { $installed->install(json_encode($this->pack(), JSON_THROW_ON_ERROR)); self::fail('Installed without verified images'); }
        catch (\RuntimeException $error) { self::assertSame([], $installed->entries()); }
        self::assertDirectoryDoesNotExist($this->directory . '/packs');
    }
}

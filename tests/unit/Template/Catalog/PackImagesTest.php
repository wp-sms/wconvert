<?php
namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Catalog\{DesignArchive, PackValidator, TemplateCatalog, VerifiedAssets};
use WConvert\Tests\Unit\Support\FakeOptionStore;

/** A design's images: verified, local, reused and never deleted (ADR 0082, ADR 0156). */
final class PackImagesTest extends TestCase
{
    private string $directory;
    private const IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=';
    protected function setUp(): void { $this->directory = sys_get_temp_dir() . '/wconvert-media-flow-' . bin2hex(random_bytes(8)); $GLOBALS['wconvertTestTransients'] = []; }
    protected function tearDown(): void
    {
        if (!is_dir($this->directory)) return;
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($this->directory);
    }

    private function serve(CatalogFixture $service, int $revision = 1): void
    {
        $image = (string) base64_decode(self::IMAGE);
        $design = $service->design('resources/templates/library/reading-slip.json', 'illustrated', $revision, [
            'assets' => [['id' => 'plant', 'sha256' => hash('sha256', $image), 'mime' => 'image/png', 'bytes' => strlen($image), 'width' => 1, 'height' => 1, 'access' => 'free']],
            'image_bindings' => [['node_id' => 'n99', 'asset_id' => 'plant']],
        ]);
        $tree = $design['object']['tree'];
        $tree['steps'][0]['content']['children'][] = ['type' => 'image', 'id' => 'n99', 'src' => '', 'alt' => 'A plant'];
        $last = count($service->designs) - 1;
        $service->designs[$last]['object']['tree'] = $tree;
        $service->designs[$last]['object']['requires']['capabilities'][] = 'pack-images:1';
        $service->http->responses[CatalogFixture::BASE . 'assets/' . hash('sha256', $image) . '.png'] = $image;
        $service->publish();
    }

    public function testPreviewInstallOfflineRepairAndUpdateKeepExactLocalImages(): void
    {
        $http = new FakeCatalogTransport();
        $service = new CatalogFixture($http);
        $this->serve($service);
        $validator = PackValidator::shipping();
        $assets = new VerifiedAssets($this->directory . '/images', 'https://site.example/local-images');
        $archive = fn (): DesignArchive => new DesignArchive($this->directory . '/designs', $validator, 'secret', $assets, 'free');
        $options = new FakeOptionStore();
        $options->set(TemplateCatalog::SOURCE_OPTION, CatalogFixture::SOURCE);
        $options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $catalog = fn (): TemplateCatalog => new TemplateCatalog($options, $http, $validator, $archive());
        $catalog()->refresh();
        $preview = $catalog()->preview('illustrated');
        self::assertCount(0, $archive()->entries(), 'Preview caches images but does not install the design');
        $imageUrl = CatalogFixture::BASE . 'assets/' . hash('sha256', (string) base64_decode(self::IMAGE)) . '.png';
        self::assertSame(1, count(array_keys($http->requests, $imageUrl, true)));
        $catalog()->install('illustrated', $preview['sha256']);
        self::assertSame(1, count(array_keys($http->requests, $imageUrl, true)), 'Install reuses the image the preview cached');
        $before = $archive()->entries()[0];
        self::assertStringContainsString('https://site.example/local-images/free/', json_encode($before, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));

        $service->designs = [];
        $this->serve($service, 2);
        $catalog()->refresh();
        $catalog()->install('illustrated', $service->sha('illustrated', 2));
        self::assertSame(1, count(array_keys($http->requests, $imageUrl, true)), 'Unchanged image reused across revisions');

        $path = $this->directory . '/images/free/' . hash('sha256', (string) base64_decode(self::IMAGE)) . '.png';
        file_put_contents($path, 'damaged'); clearstatcache();
        self::assertSame([], $archive()->entries(), 'An incomplete image set does not become usable');
        $catalog()->preview('illustrated');
        self::assertSame(2, count(array_keys($http->requests, $imageUrl, true)), 'Explicit preview repairs the cache');
        self::assertCount(2, $archive()->entries(), 'Both revisions are usable again; with no row references to read, nothing is pruned');
    }

    public function testMissingAndInvalidBindingsCannotBeInstalled(): void
    {
        $validator = PackValidator::shipping();
        $service = new CatalogFixture(new FakeCatalogTransport());
        $this->serve($service);
        $object = $service->designs[0]['object'];
        foreach (['missing', 'duplicate', 'not-image', 'external', 'premium', 'undeclared', 'unused'] as $case) {
            $design = $object;
            if ($case === 'missing') $design['image_bindings'][0]['asset_id'] = 'missing';
            if ($case === 'duplicate') $design['image_bindings'][] = $design['image_bindings'][0];
            if ($case === 'not-image') $design['image_bindings'][0]['node_id'] = 'n1';
            if ($case === 'external') $design['assets'][0]['url'] = 'https://tracker.example/pixel';
            if ($case === 'premium') $design['assets'][0]['access'] = 'premium';
            if ($case === 'undeclared') $design['requires']['capabilities'] = array_values(array_diff($design['requires']['capabilities'], ['pack-images:1']));
            if ($case === 'unused') $design['image_bindings'] = [];
            $json = json_encode($design, JSON_THROW_ON_ERROR);
            try { $validator->validate(\WConvert\Template\Catalog\DesignObject::design($json, hash('sha256', $json))['pack']); self::fail('Accepted ' . $case); }
            catch (\RuntimeException $error) { self::assertNotSame('', $error->getMessage()); }
        }
    }
}

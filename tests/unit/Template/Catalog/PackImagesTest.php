<?php
namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use WConvert\Support\Tier;
use WConvert\Template\Catalog\{DesignArchive, DesignObject, PackImages, PackValidator, TemplateCatalog, VerifiedAssets};
use WConvert\Tests\Unit\Support\FakeOptionStore;

/** A design's images: verified, local, reused and never deleted (ADR 0082, ADR 0156), bound by slot (ADR 0162). */
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
            'image_bindings' => [['slot' => 'tree/steps/0/content/children/' . count(json_decode((string) file_get_contents(WCONVERT_DIR . 'resources/templates/library/reading-slip.json'), true)['tree']['steps'][0]['content']['children']) . '/src', 'asset_id' => 'plant']],
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
        foreach (['missing', 'duplicate', 'not-a-slot', 'old-shape', 'external', 'premium', 'undeclared', 'unused'] as $case) {
            $design = $object;
            if ($case === 'missing') $design['image_bindings'][0]['asset_id'] = 'missing';
            if ($case === 'duplicate') $design['image_bindings'][] = $design['image_bindings'][0];
            if ($case === 'not-a-slot') $design['image_bindings'][0]['slot'] = 'tree/steps/0/content/children/0/src';
            if ($case === 'old-shape') $design['image_bindings'][0] = ['node_id' => 'n99', 'asset_id' => 'plant'];
            if ($case === 'external') $design['assets'][0]['url'] = 'https://tracker.example/pixel';
            if ($case === 'premium') $design['assets'][0]['access'] = 'premium';
            if ($case === 'undeclared') $design['requires']['capabilities'] = array_values(array_diff($design['requires']['capabilities'], ['pack-images:1']));
            if ($case === 'unused') $design['image_bindings'] = [];
            $json = json_encode($design, JSON_THROW_ON_ERROR);
            try { $validator->validate(\WConvert\Template\Catalog\DesignObject::design($json, hash('sha256', $json))['pack']); self::fail('Accepted ' . $case); }
            catch (\RuntimeException $error) { self::assertNotSame('', $error->getMessage()); }
        }
    }

    /**
     * Halloween monster as the catalogue serves it: both screens' backgrounds
     * left empty, plus whatever `$shape` adds, every slot bound to one asset.
     *
     * @param list<string> $slots
     * @param callable(array<string, mixed>): array<string, mixed> $shape
     * @return array<string, mixed> the design object
     */
    private function backgrounds(CatalogFixture $service, array $slots, callable $shape, string $file = 'resources/templates/library/halloween-monster.json', string $access = 'free'): array
    {
        $image = (string) base64_decode(self::IMAGE);
        $source = json_decode((string) file_get_contents(WCONVERT_DIR . $file), true, 64, JSON_THROW_ON_ERROR);
        $design = $shape(['tree' => $source['tree'], 'tokens' => $source['tokens']]);
        $service->design($file, 'monster', 1, ['tree' => $design['tree'], 'tokens' => $design['tokens']]);
        $last = count($service->designs) - 1;
        $service->designs[$last]['object']['assets'] = [['id' => 'monster', 'sha256' => hash('sha256', $image), 'mime' => 'image/png', 'bytes' => strlen($image), 'width' => 1, 'height' => 1, 'access' => $access]];
        $service->designs[$last]['object']['image_bindings'] = array_map(static fn (string $slot): array => ['slot' => $slot, 'asset_id' => 'monster'], $slots);
        $service->designs[$last]['object']['requires']['capabilities'][] = 'pack-images:1';
        $service->http->responses[CatalogFixture::BASE . ($access === 'free' ? '' : 'premium/') . 'assets/' . hash('sha256', $image) . '.png'] = $image;
        $service->publish();
        return $service->designs[$last]['object'];
    }

    /** @param array<string, mixed> $design
     * @return array<string, mixed> */
    private static function emptied(array $design): array
    {
        foreach ($design['tree']['steps'] as &$step) $step['content']['tokens']['bg-image'] = 'none';
        return $design;
    }

    public function testBackgroundsAndImagesBindBySlotAndHydrateToVerifiedLocalUrls(): void
    {
        $service = new CatalogFixture(new FakeCatalogTransport());
        $slots = ['tree/steps/0/content/tokens/bg-image', 'tree/steps/1/content/tokens/bg-image', 'tree/steps/0/content/narrow/bg-image', 'tokens/bg-image'];
        $object = $this->backgrounds($service, [...$slots, 'tree/steps/1/content/children/0/src'], static function (array $design): array {
            $design = self::emptied($design);
            $design['tree']['steps'][0]['content']['narrow'] = ['bg-image' => 'none'];
            $design['tokens']['bg-image'] = 'none';
            array_unshift($design['tree']['steps'][1]['content']['children'], ['type' => 'image', 'id' => 'n99', 'src' => '', 'alt' => 'A monster']);
            return $design;
        });
        $options = new FakeOptionStore();
        $options->set(TemplateCatalog::SOURCE_OPTION, CatalogFixture::SOURCE);
        $options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $archive = new DesignArchive($this->directory . '/designs', PackValidator::shipping(), 'secret', new VerifiedAssets($this->directory . '/images', 'https://site.example/local-images'), 'free');
        $catalog = new TemplateCatalog($options, $service->http, PackValidator::shipping(), $archive);
        $catalog->refresh();
        $catalog->install('monster', $service->sha('monster'));

        $url = 'https://site.example/local-images/free/' . hash('sha256', (string) base64_decode(self::IMAGE)) . '.png';
        $installed = $archive->entries()[0];
        self::assertCount(1, $object['assets'], 'C1: one asset for two screens');
        self::assertSame('url("' . $url . '")', $installed['tree']['steps'][0]['content']['tokens']['bg-image'], 'C1, C11');
        self::assertSame('url("' . $url . '")', $installed['tree']['steps'][1]['content']['tokens']['bg-image'], 'C1: a layout node with no id');
        self::assertSame('url("' . $url . '")', $installed['tree']['steps'][0]['content']['narrow']['bg-image'], 'C2: phone only');
        self::assertArrayNotHasKey('bg-image', $installed['tree']['steps'][1]['content']['narrow'], 'C2: nothing invented for the other screen');
        self::assertSame('url("' . $url . '")', $installed['tokens']['bg-image'], 'C3: design-level background');
        self::assertSame($url, $installed['tree']['steps'][1]['content']['children'][0]['src'], 'C4: an image in the same design, unwrapped');
    }

    public function testAGradientIsNoSlotAndStaysAToken(): void
    {
        $service = new CatalogFixture(new FakeCatalogTransport());
        $object = $this->backgrounds($service, ['tree/steps/0/content/tokens/bg-image', 'tree/steps/1/content/tokens/bg-image'], static function (array $design): array {
            $design = self::emptied($design);
            $design['tokens']['bg-image'] = 'linear-gradient(#000000, #ffffff)';
            return $design;
        });
        $json = (string) json_encode($object);
        $pack = DesignObject::design($json, hash('sha256', $json))['pack'];
        $validated = PackValidator::shipping()->validate($pack);
        self::assertSame('linear-gradient(#000000, #ffffff)', PackImages::hydrate($validated, ['monster' => 'https://site.example/x.png'])['templates'][0]['tokens']['bg-image']);
        $pack['image_bindings'][] = ['template_id' => 'monster', 'slot' => 'tokens/bg-image', 'asset_id' => 'monster'];
        $this->expectExceptionMessage('Image binding is missing or repeated.');
        PackValidator::shipping()->validate($pack);
    }

    /** C9, C10: each tampered binding is refused by the reader, with the design otherwise valid. */
    public function testTamperedBackgroundBindingsAreRefused(): void
    {
        $template = ['id' => 'monster', 'name' => 'Monster', 'display_type' => 'popup', 'tier' => 'free', 'tokens' => ['bg-image' => 'none'],
            'tree' => ['steps' => [['id' => 's1', 'content' => ['type' => 'stack', 'tokens' => ['bg-image' => 'url("https://site.example/filled.png")'], 'children' => [['type' => 'image', 'id' => 'n1', 'src' => '']]]]]]];
        $asset = ['id' => 'monster', 'sha256' => str_repeat('a', 64), 'mime' => 'image/png', 'bytes' => 1, 'width' => 1, 'height' => 1, 'access' => 'free'];
        $pack = ['assets' => [$asset], 'requires' => ['capabilities' => ['pack-images:1']], 'templates' => [$template],
            'image_bindings' => [['template_id' => 'monster', 'slot' => 'tokens/bg-image', 'asset_id' => 'monster']]];
        PackImages::validate($pack);
        $cases = [
            'unknown slot' => fn (array $pack): array => array_replace_recursive($pack, ['image_bindings' => [['slot' => 'tree/steps/0/content/narrow/bg-image']]]),
            'slot already holds a picture' => fn (array $pack): array => array_replace_recursive($pack, ['image_bindings' => [['slot' => 'tree/steps/0/content/tokens/bg-image']]]),
            'repeated slot' => fn (array $pack): array => ['image_bindings' => [...$pack['image_bindings'], $pack['image_bindings'][0]]] + $pack,
            'unused asset' => fn (array $pack): array => ['assets' => [...$pack['assets'], ['id' => 'spare'] + $asset]] + $pack,
            'premium asset in a Free design' => fn (array $pack): array => array_replace_recursive($pack, ['assets' => [['access' => 'premium']]]),
            'unknown design' => fn (array $pack): array => array_replace_recursive($pack, ['image_bindings' => [['template_id' => 'other']]]),
            'node id instead of slot' => fn (array $pack): array => ['image_bindings' => [['template_id' => 'monster', 'node_id' => 'n1', 'asset_id' => 'monster']]] + $pack,
        ];
        foreach ($cases as $case => $tamper) {
            try { PackImages::validate($tamper($pack)); self::fail('Accepted ' . $case); }
            catch (\RuntimeException $error) { self::assertNotSame('', $error->getMessage(), $case); }
        }
    }

    public function testAProDesignsPremiumBackgroundNeedsAPass(): void
    {
        $http = new FakePremiumTransport();
        $service = new CatalogFixture($http);
        $this->backgrounds($service, ['tree/steps/0/content/children/0/children/0/children/0/tokens/bg-image'], static function (array $design): array {
            $design['tree']['steps'][0]['content']['children'][0]['children'][0]['children'][0]['tokens']['bg-image'] = 'none';
            return $design;
        }, 'pro/modules/display-types/templates/halloween-countdown.json', 'premium');
        $options = new FakeOptionStore();
        $options->set(TemplateCatalog::SOURCE_OPTION, CatalogFixture::SOURCE);
        $options->set(TemplateCatalog::CONSENT_OPTION, 'yes');
        $pro = new PackValidator(\WConvert\Template\TemplateManifest::load(), \WConvert\Template\TemplateVocabulary::fromManifest(), Tier::Pro);
        $archive = new DesignArchive($this->directory . '/designs', $pro, 'secret', new VerifiedAssets($this->directory . '/images', 'https://site.example/local-images'), 'pro');
        $catalog = new TemplateCatalog($options, $http, $pro, $archive, Tier::Pro);
        $catalog->refresh();
        $catalog->install('monster', $service->sha('monster'));
        $sha = hash('sha256', (string) base64_decode(self::IMAGE));
        self::assertContains(CatalogFixture::BASE . 'premium/assets/' . $sha . '.png', $http->requests, 'Fetched with the pass, never from the public path');
        self::assertNotContains(CatalogFixture::BASE . 'assets/' . $sha . '.png', $http->requests);
        self::assertSame('url("https://site.example/local-images/premium/' . $sha . '.png")',
            $archive->entries()[0]['tree']['steps'][0]['content']['children'][0]['children'][0]['children'][0]['tokens']['bg-image']);
    }
}

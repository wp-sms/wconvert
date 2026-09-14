<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use RuntimeException;
use WConvert\Template\Catalog\CatalogTransport;
use WConvert\Template\Catalog\InstalledPacks;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeOptionStore;

final class TemplateCatalogTest extends TestCase
{
    private string $directory;
    private PackValidator $validator;
    private InstalledPacks $installed;
    private FakeOptionStore $options;
    private TemplateCatalog $catalog;
    private FakeCatalogTransport $http;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/wconvert-packs-' . bin2hex(random_bytes(8));
        $this->validator = PackValidator::shipping();
        $this->installed = new InstalledPacks($this->directory, $this->validator);
        $this->options = new FakeOptionStore();
        $this->http = new FakeCatalogTransport();
        $this->catalog = new TemplateCatalog($this->options, $this->http, $this->validator, $this->installed);
        $this->options->set(TemplateCatalog::SOURCE_OPTION, 'https://catalog.example/index.json');
    }

    protected function tearDown(): void
    {
        foreach (glob($this->directory . '/*') ?: [] as $file) unlink($file);
        if (is_dir($this->directory)) rmdir($this->directory);
    }

    /** @return array<string, mixed> */
    private function pack(string $version = '1.0.0'): array
    {
        $entry = json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json'), true, 512, JSON_THROW_ON_ERROR);
        return ['schema' => 1, 'id' => 'reading', 'name' => 'Reading', 'description' => 'A reading card.', 'version' => $version,
            'requires' => ['plugin' => '0.1.0', 'tree' => 1, 'capabilities' => ['template-tree:1']], 'assets' => [], 'templates' => [$entry]];
    }

    /** @param array<string, mixed> $pack */
    private function serve(array $pack): void
    {
        $json = json_encode($pack, JSON_THROW_ON_ERROR);
        $this->http->responses['https://catalog.example/pack.json'] = $json;
        $this->http->responses['https://catalog.example/index.json'] = json_encode(['schema' => 1, 'packs' => [[
            'id' => $pack['id'], 'version' => $pack['version'], 'name' => $pack['name'], 'description' => $pack['description'],
            'url' => 'https://catalog.example/pack.json', 'sha256' => hash('sha256', $json),
        ]]], JSON_THROW_ON_ERROR);
    }

    public function testBrowsePreviewInstallOfflineAndUpdateKeepTheOriginalBaseline(): void
    {
        $this->serve($this->pack());
        $this->assertSame([], $this->catalog->status()['packs']);
        $this->assertSame([], $this->http->requests, 'Opening the library never contacts the service.');
        $this->catalog->refresh();
        $preview = $this->catalog->preview('reading');
        $this->assertCount(0, $this->installed->entries(), 'Preview never installs.');
        $this->catalog->install('reading', $preview['digest']);
        $this->assertSame($preview['templates'][0]['id'], $this->installed->entries()[0]['id']);
        $vocabulary = TemplateVocabulary::fromManifest();
        $before = TemplateLibrary::from($vocabulary, $this->installed)->find($preview['templates'][0]['id']);
        $draft = ['template_id' => $before['id'], 'template' => ['tree' => $before['tree'], 'tokens' => $before['tokens']]];
        $snapshot = json_encode($draft, JSON_THROW_ON_ERROR);
        $this->http->responses = [];
        $requests = count($this->http->requests);
        $this->assertSame($preview, $this->catalog->preview('reading', true));
        $this->assertSame('installed', $this->catalog->status()['packs'][0]['state']);
        $this->assertSame($requests, count($this->http->requests));
        try { $this->catalog->refresh(); $this->fail('Expected offline error'); } catch (RuntimeException $error) { $this->assertSame('Offline', $error->getMessage()); }
        $this->assertSame('installed', $this->catalog->status()['packs'][0]['state']);
        $next = $this->pack('1.1.0');
        $next['templates'][0]['tokens']['bg'] = '#ffffff';
        $this->serve($next);
        $this->assertSame('update', $this->catalog->refresh()['packs'][0]['state']);
        $updated = $this->catalog->preview('reading');
        $this->catalog->install('reading', $updated['digest']);
        $library = TemplateLibrary::from($vocabulary, $this->installed);
        $this->assertEquals($before['tree'], $library->find($before['id'])['tree']);
        $this->assertEquals($before['tokens'], $library->find($before['id'])['tokens']);
        $this->assertFalse($library->find($before['id'])['catalog_current']);
        $this->assertTrue($library->find($updated['templates'][0]['id'])['catalog_current']);
        $this->assertSame($snapshot, json_encode($draft, JSON_THROW_ON_ERROR));
    }

    public function testChangedDownloadAndChangedPreviewCannotInstall(): void
    {
        $this->serve($this->pack()); $this->catalog->refresh();
        $preview = $this->catalog->preview('reading');
        $this->serve($this->pack('1.1.0'));
        try { $this->catalog->install('reading', $preview['digest']); $this->fail(); } catch (RuntimeException $e) { $this->assertStringContainsString('did not match', $e->getMessage()); }
        $this->catalog->refresh();
        try { $this->catalog->install('reading', $preview['digest']); $this->fail(); } catch (RuntimeException $e) { $this->assertStringContainsString('changed after', $e->getMessage()); }
        $this->assertSame([], $this->installed->entries());
    }

    public function testUnknownUnsafeOrOversizedContentNeverEntersTheLibrary(): void
    {
        $changes = [
            ['schema', 2], ['assets', [['url' => 'https://tracker.example/pixel.png']]],
            ['requires.capabilities', ['execute-php']], ['requires.capabilities', []], ['requires.tree', null], ['requires.plugin', '999.0.0'],
            ['templates.0.tree.steps.0.type', 'script'], ['templates.0.tree.steps.0.id', 'n1'], ['templates.0.tokens.bg', 'red; } body {display:none'],
            ['templates.0.tokens.bg-image', 'url(https://tracker.example/pixel)'],
            ['templates.0.tokens.bg-image', 'u\\72l(https://tracker.example/pixel)'],
            ['templates.0.tokens.bg', ['red']], ['templates.0.tree.steps.0.children.0.text', ['bad']],
            ['templates.0.tree.steps.0.children.0.italic', true],
            ['templates.0.tree.steps.0.children.0.text', '<script>alert(1)</script>'],
            ['templates.0.tree.steps.0.children.5.href', 'javascript:alert(1)'],
            ['templates.0.tree.steps.0.children.5.action', 'execute'],
            ['templates.0.tree.steps.0.children.1.id', 'n1'], ['templates.0.tier', 'basic'],
        ];
        foreach ($changes as [$path, $value]) {
            $pack = $this->pack(); $target =& $pack; $keys = explode('.', $path); $last = array_pop($keys);
            foreach ($keys as $key) $target =& $target[$key];
            $target[$last] = $value; unset($target);
            try { $this->validator->decode(json_encode($pack, JSON_THROW_ON_ERROR)); $this->fail('Accepted ' . $path); }
            catch (RuntimeException $error) { $this->assertNotSame('', $error->getMessage()); }
        }
        $this->expectException(RuntimeException::class);
        $this->validator->decode(str_repeat(' ', PackValidator::MAX_BYTES + 1));
    }

    public function testCorruptLocalFileDoesNotRemoveBundledDesignsAndCannotExecute(): void
    {
        mkdir($this->directory);
        file_put_contents($this->directory . '/bad.json', '<?php throw new Exception("executed");');
        $library = TemplateLibrary::from(TemplateVocabulary::fromManifest(), new \WConvert\Template\BundledTemplates(WCONVERT_DIR), $this->installed);
        $this->assertNotNull($library->find('reading-slip'));
        $this->assertCount(37, $library->all());
    }

    public function testSameReleaseIsIdempotentAndCannotOverwriteItsBaseline(): void
    {
        $json = json_encode($this->pack(), JSON_THROW_ON_ERROR);
        $first = $this->installed->install($json);
        $this->assertSame($first, $this->installed->install($json));
        $changed = $this->pack(); $changed['name'] = 'Changed';
        try { $this->installed->install(json_encode($changed, JSON_THROW_ON_ERROR)); $this->fail(); } catch (RuntimeException $e) { $this->assertStringContainsString('already installed', $e->getMessage()); }
        $this->assertCount(1, $this->installed->packs());
    }

    public function testEveryUsedFeatureMustBeDeclaredAndFieldOptionsMustBelongToAChoice(): void
    {
        foreach (['callback-notes', 'useful-guide'] as $id) {
            $pack = $this->pack();
            $pack['templates'] = [json_decode((string) file_get_contents(WCONVERT_DIR . '/resources/templates/library/' . $id . '.json'), true, 512, JSON_THROW_ON_ERROR)];
            try { $this->validator->decode(json_encode($pack, JSON_THROW_ON_ERROR)); $this->fail('Undeclared feature accepted'); }
            catch (RuntimeException $error) { $this->assertStringContainsString('declare every capability', $error->getMessage()); }
        }
        $pack = $this->pack();
        $pack['templates'][0]['tree']['steps'][0]['children'][] = ['type' => 'field', 'id' => 'extra', 'name' => 'email', 'label' => 'Email', 'options' => [['value' => 'one', 'label' => 'One']]];
        $this->expectException(RuntimeException::class);
        $this->validator->decode(json_encode($pack, JSON_THROW_ON_ERROR));
    }

    public function testReinstallRepairsACorruptCopyInsteadOfReportingFalseSuccess(): void
    {
        $json = json_encode($this->pack(), JSON_THROW_ON_ERROR);
        $pack = $this->installed->install($json);
        file_put_contents($this->directory . '/' . $pack['digest'] . '.json', 'broken');
        $this->assertCount(0, $this->installed->entries());
        $this->installed->install($json);
        $this->assertCount(1, $this->installed->entries());
    }

    public function testCatalogCannotSendPackRequestsToAnotherOrigin(): void
    {
        $this->serve($this->pack());
        $index = json_decode($this->http->responses['https://catalog.example/index.json'], true);
        $index['packs'][0]['url'] = 'https://other.example/pack.json';
        $this->http->responses['https://catalog.example/index.json'] = json_encode($index, JSON_THROW_ON_ERROR);
        $this->expectException(RuntimeException::class);
        $this->catalog->refresh();
    }
}

final class FakeCatalogTransport implements CatalogTransport
{
            /** @var array<string, string> */
            public array $responses = [];
            /** @var list<string> */
            public array $requests = [];
            public function get(string $url): string {
                $this->requests[] = $url;
                return $this->responses[$url] ?? throw new RuntimeException('Offline');
            }

}

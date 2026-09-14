<?php

namespace WConvert\Tests\Unit\Template\Catalog;

use PHPUnit\Framework\TestCase;
use WConvert\Template\Catalog\CatalogTransport;
use WConvert\Template\Catalog\InstalledPacks;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;
use WConvert\Tests\Unit\Support\FakeOptionStore;

final class CuratedCollectionsTest extends TestCase
{
    private string $directory;

    protected function setUp(): void
    {
        $this->directory = sys_get_temp_dir() . '/wconvert-collections-' . bin2hex(random_bytes(8));
        mkdir($this->directory);
    }

    protected function tearDown(): void
    {
        foreach (['', '/installed'] as $suffix) {
            foreach (glob($this->directory . $suffix . '/*.json') ?: [] as $file) unlink($file);
        }
        if (is_dir($this->directory . '/installed')) rmdir($this->directory . '/installed');
        rmdir($this->directory);
    }

    /** @return array{int, string} */
    private function build(): array
    {
        exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(WCONVERT_DIR . 'tools/template-catalog/build.php')
            . ' https://catalog.example/collections ' . escapeshellarg($this->directory) . ' 2>&1', $output, $code);
        return [$code, implode("\n", $output)];
    }

    public function testBuiltCollectionsRoundTripThroughPreviewInstallOfflineAndDraftPreparation(): void
    {
        [$code, $message] = $this->build();
        $this->assertSame(0, $code, $message);
        $indexBytes = (string) file_get_contents($this->directory . '/index.json');
        $index = json_decode($indexBytes, true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['store-collection', 'publisher-collection', 'service-collection'], array_column($index['packs'], 'id'));
        $transport = new class ($this->directory) implements CatalogTransport {
            public bool $offline = false;
            public function __construct(private readonly string $directory) {}
            public function get(string $url): string
            {
                if ($this->offline) throw new \RuntimeException('Offline');
                if (!str_starts_with($url, 'https://catalog.example/collections/')) throw new \RuntimeException('Unexpected origin');
                return (string) file_get_contents($this->directory . '/' . basename($url));
            }
        };
        $options = new FakeOptionStore();
        $options->set(TemplateCatalog::SOURCE_OPTION, 'https://catalog.example/collections/index.json');
        $validator = PackValidator::shipping();
        $installed = new InstalledPacks($this->directory . '/installed', $validator);
        $catalog = new TemplateCatalog($options, $transport, $validator, $installed);
        $this->assertCount(3, $catalog->refresh()['packs']);
        $vocabulary = TemplateVocabulary::fromManifest();
        $bundled = TemplateLibrary::fromDirectory($vocabulary, WCONVERT_DIR);
        $previews = [];
        $seen = [];
        foreach ($index['packs'] as $entry) {
            $json = $transport->get($entry['url']);
            $this->assertSame($entry['sha256'], hash('sha256', $json));
            $raw = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
            $before = count($installed->entries());
            $preview = $catalog->preview($entry['id']);
            $this->assertCount($before, $installed->entries(), 'Preview must not install.');
            $catalog->install($entry['id'], $preview['digest']);
            $library = TemplateLibrary::from($vocabulary, $installed);
            foreach ($raw['templates'] as $position => $source) {
                $this->assertArrayNotHasKey($source['id'], $seen, 'Each design belongs to one collection.');
                $seen[$source['id']] = true;
                $this->assertSame(json_decode((string) file_get_contents(WCONVERT_DIR . 'resources/templates/library/' . $source['id'] . '.json'), true), $source);
                $template = $preview['templates'][$position];
                $expected = $bundled->find($source['id']);
                $this->assertSame($expected['tree'], $template['tree'], 'Copy, layout, identities and narrow styles survive import.');
                $this->assertSame($expected['tokens'], $template['tokens']);
                $this->assertSame($template['tree'], $library->find($template['id'])['tree']);
                $originalDraft = $bundled->snapshotInto(['template_id' => $source['id'], 'template' => $expected]);
                $installedDraft = $library->snapshotInto(['template_id' => $template['id'], 'template' => $template]);
                $this->assertSame($originalDraft['template'], $installedDraft['template'], 'Editor preparation matches the reviewed bundled design.');
            }
            $previews[$entry['id']] = $preview;
        }
        $this->assertCount(10, $seen);
        $this->assertCount(10, $installed->entries());
        $transport->offline = true;
        foreach ($previews as $id => $preview) $this->assertSame($preview, $catalog->preview($id, true));
        $this->assertSame(['installed', 'installed', 'installed'], array_column($catalog->status()['packs'], 'state'));
        [$code, $message] = $this->build();
        $this->assertSame(0, $code, $message);
        $this->assertSame($indexBytes, file_get_contents($this->directory . '/index.json'), 'Rebuilding is deterministic.');
    }

    public function testAConflictingReleaseDoesNotReplaceFilesOrIndex(): void
    {
        $path = $this->directory . '/publisher-collection-1.0.0.json';
        file_put_contents($path, 'previous release');
        file_put_contents($this->directory . '/index.json', 'previous index');
        [$code, $message] = $this->build();
        $this->assertSame(1, $code);
        $this->assertStringContainsString('Refusing to replace', $message);
        $this->assertSame('previous release', file_get_contents($path));
        $this->assertSame('previous index', file_get_contents($this->directory . '/index.json'));
        $this->assertFileDoesNotExist($this->directory . '/store-collection-1.0.0.json', 'All releases are checked before any output changes.');
    }
}

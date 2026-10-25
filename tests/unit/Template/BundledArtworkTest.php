<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\BundledArtwork;
use WConvert\Template\BundledTemplates;

/** A bundled photo is named once and read from its file (ADR 0172). */
#[CoversClass(BundledArtwork::class)]
#[CoversClass(BundledTemplates::class)]
final class BundledArtworkTest extends TestCase
{
    private string $root = '';

    protected function tearDown(): void
    {
        if ($this->root === '') return;
        $files = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($this->root, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir((string) $file) : unlink((string) $file);
        rmdir($this->root);
    }

    /** A disposable plugin folder holding one artwork file; returns its reference. */
    private function plugin(string $bytes, ?string $written = null): string
    {
        $this->root = sys_get_temp_dir() . '/wconvert-artwork-' . bin2hex(random_bytes(5));
        mkdir($this->root . '/resources/template-artwork', 0777, true);
        $name = hash('sha256', $bytes) . '.webp';
        file_put_contents($this->root . '/resources/template-artwork/' . $name, $written ?? $bytes);
        return 'artwork:' . $name;
    }

    /** @return array<string, mixed> */
    private static function picture(string $src): array
    {
        return ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => $src]]]]];
    }

    /** The studio, the exporter and CLI tools have no site: they get the bytes, checked against the name. */
    public function testWithoutASiteThePhotoIsItsBytes(): void
    {
        $reference = $this->plugin('reviewed bytes');
        $uri = 'data:image/webp;base64,' . base64_encode('reviewed bytes');

        self::assertSame($uri, BundledArtwork::inlined(self::picture($reference), $this->root)['tree']['steps'][0]['content']['src']);
        self::assertSame($uri, BundledArtwork::forSite(self::picture($reference), $this->root, '')['tree']['steps'][0]['content']['src']);
    }

    /** Pro's photos live under Pro's own folder; a campaign made from one carries Pro's URL. */
    public function testAProPhotoIsAUrlUnderProsOwnFolder(): void
    {
        $pro = dirname(__DIR__, 3) . '/pro';
        $entry = json_decode((string) file_get_contents($pro . '/modules/display-types/templates/polaroid.json'), true);
        $reference = $entry['tree']['steps'][0]['content']['children'][0]['children'][0]['src'];

        $resolved = BundledArtwork::forSite($entry, $pro, 'https://shop.example/plugins/wconvert-pro/');

        self::assertSame(
            'https://shop.example/plugins/wconvert-pro/resources/template-artwork/' . substr($reference, strlen('artwork:')),
            $resolved['tree']['steps'][0]['content']['children'][0]['children'][0]['src']
        );
    }

    /** A background keeps its `url()` and its scope, so DesignImages still sees a picture where the author put it. */
    public function testABackgroundStaysABackgroundInItsOwnScope(): void
    {
        $root = dirname(__DIR__, 3);
        foreach (['engraved', 'monster', 'forest', 'bats'] as $name) {
            $entry = json_decode((string) file_get_contents($root . '/resources/templates/library/halloween-' . $name . '.json'), true);
            $resolved = BundledArtwork::forSite($entry, $root, 'https://shop.example/custom/wconvert/');
            foreach ($resolved['tree']['steps'] as $step) {
                self::assertMatchesRegularExpression('#^url\("https://shop\.example/custom/wconvert/resources/template-artwork/[a-f0-9]{64}\.webp"\)$#', $step['content']['tokens']['bg-image']);
            }
            self::assertSame($entry['tree']['fonts'], $resolved['tree']['fonts']);
        }
    }

    public function testAnythingElseIsNeverRewritten(): void
    {
        foreach (['data:image/jpeg;base64,' . base64_encode('inline'), 'https://merchant.example/photo.jpg', 'artwork:not-a-hash.webp', 'artwork:' . str_repeat('a', 64) . '.png', 'Our artwork: hand-thrown'] as $source) {
            $entry = ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => $source, 'text' => $source]]]]];
            self::assertSame($entry, BundledArtwork::forSite($entry, dirname(__DIR__, 3), 'https://shop.example/'));
        }
    }

    public function testAMissingFileIsABrokenZipNotAPictureToGuess(): void
    {
        $this->expectExceptionMessage('Bundled artwork is missing or altered');
        BundledArtwork::forSite(self::picture('artwork:' . hash('sha256', 'gone') . '.webp'), dirname(__DIR__, 3), 'https://shop.example/');
    }

    /** Where the bytes are read they must be what was reviewed; a site's URL is checked when a campaign adopts it (TemplateMedia). */
    public function testAnAlteredFileCannotStandInForTheReviewedPicture(): void
    {
        $reference = $this->plugin('reviewed bytes', 'different bytes');

        $this->expectExceptionMessage('Bundled artwork is missing or altered');
        BundledArtwork::inlined(self::picture($reference), $this->root);
    }

    /** One design with a missing photo is left out; the library still lists the rest. */
    public function testTheLibraryLeavesOutOnlyTheDesignWhosePhotoIsMissing(): void
    {
        $reference = $this->plugin('kept');
        mkdir($this->root . '/resources/templates/library', 0777, true);
        $design = static fn (string $id, string $src): string => (string) json_encode(['id' => $id, 'name' => $id, 'display_type' => 'popup', 'tier' => 'free'] + self::picture($src));
        file_put_contents($this->root . '/resources/templates/library/kept.json', $design('kept', $reference));
        file_put_contents($this->root . '/resources/templates/library/broken.json', $design('broken', 'artwork:' . hash('sha256', 'gone') . '.webp'));

        self::assertSame(['kept'], array_column((new BundledTemplates($this->root))->entries(), 'id'));
    }
}

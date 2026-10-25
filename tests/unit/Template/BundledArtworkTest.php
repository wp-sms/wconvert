<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\BundledArtwork;

/** A bundled photo is named once and read from its file (ADR 0172). */
#[CoversClass(BundledArtwork::class)]
final class BundledArtworkTest extends TestCase
{
    private string $root = '';

    protected function tearDown(): void
    {
        if ($this->root === '') return;
        foreach (glob($this->root . '/resources/template-artwork/*') ?: [] as $file) unlink($file);
        rmdir($this->root . '/resources/template-artwork');
        rmdir($this->root . '/resources');
        rmdir($this->root);
    }

    /** A disposable plugin folder holding one artwork file; returns its reference. */
    private function plugin(string $bytes, string $written = ''): string
    {
        $this->root = sys_get_temp_dir() . '/wconvert-artwork-' . bin2hex(random_bytes(5));
        mkdir($this->root . '/resources/template-artwork', 0777, true);
        $name = hash('sha256', $bytes) . '.webp';
        file_put_contents($this->root . '/resources/template-artwork/' . $name, $written === '' ? $bytes : $written);
        return 'artwork:' . $name;
    }

    public function testAShippedPhotoIsAPluginUrlOnASite(): void
    {
        $root = dirname(__DIR__, 3);
        $entry = json_decode((string) file_get_contents($root . '/resources/templates/library/citrus-sunrise.json'), true);
        $reference = $entry['tree']['steps'][0]['content']['children'][0]['end'][0]['children'][0]['src'];
        self::assertMatchesRegularExpression('/^artwork:[a-f0-9]{64}\.webp$/', $reference);

        $resolved = BundledArtwork::forSite($entry, $root, 'https://shop.example/custom/plugins/wconvert/');

        self::assertSame(
            'https://shop.example/custom/plugins/wconvert/resources/template-artwork/' . substr($reference, strlen('artwork:')),
            $resolved['tree']['steps'][0]['content']['children'][0]['end'][0]['children'][0]['src']
        );
    }

    /** CLI tools and exports have no plugin URL: they get the bytes themselves. */
    public function testWithoutAPluginUrlThePhotoIsItsBytes(): void
    {
        $reference = $this->plugin('reviewed bytes');
        $entry = ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => $reference]]]]];

        $resolved = BundledArtwork::forSite($entry, $this->root, '');

        self::assertSame('data:image/webp;base64,' . base64_encode('reviewed bytes'), $resolved['tree']['steps'][0]['content']['src']);
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
        foreach (['data:image/jpeg;base64,' . base64_encode('inline'), 'https://merchant.example/photo.jpg', 'artwork:not-a-hash.webp', 'Our artwork: hand-thrown'] as $source) {
            $entry = ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => $source, 'text' => $source]]]]];
            self::assertSame($entry, BundledArtwork::forSite($entry, dirname(__DIR__, 3), 'https://shop.example/'));
        }
    }

    public function testAMissingFileIsABrokenZipNotAPictureToGuess(): void
    {
        $entry = ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => 'artwork:' . hash('sha256', 'gone') . '.webp']]]]];

        $this->expectExceptionMessage('Bundled artwork is missing or altered');
        BundledArtwork::forSite($entry, dirname(__DIR__, 3), 'https://shop.example/');
    }

    public function testAnAlteredFileCannotStandInForTheReviewedPicture(): void
    {
        $reference = $this->plugin('reviewed bytes', 'different bytes');
        $entry = ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => $reference]]]]];

        $this->expectExceptionMessage('Bundled artwork is missing or altered');
        BundledArtwork::forSite($entry, $this->root, 'https://shop.example/');
    }
}

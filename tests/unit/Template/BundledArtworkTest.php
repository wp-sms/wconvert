<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\BundledArtwork;

#[CoversClass(BundledArtwork::class)]
final class BundledArtworkTest extends TestCase
{
    public function testExistingBundledDesignsRemainByteForByteEquivalent(): void
    {
        $root = dirname(__DIR__, 3);
        foreach (glob($root . '/resources/templates/library/*.json') ?: [] as $file) {
            $source = file_get_contents($file);
            self::assertIsString($source);
            $entry = json_decode($source, true);
            if (in_array($entry['id'], ['citrus-sunrise', 'trail-window', 'halloween-engraved', 'halloween-monster', 'halloween-forest', 'halloween-bats'], true)) {
                continue;
            }
            self::assertSame(
                $entry,
                BundledArtwork::forSite($entry, $root, 'https://shop.example/plugins/wconvert/'),
                $entry['id']
            );
        }
    }

    public function testShippedPhotoBecomesASiteLocalUrlWhilePortableExportsKeepTheBytes(): void
    {
        $root = dirname(__DIR__, 3);
        $json = file_get_contents($root . '/resources/templates/library/citrus-sunrise.json');
        self::assertIsString($json);
        $entry = json_decode($json, true);
        $source = $entry['tree']['steps'][0]['content']['children'][0]['end'][0]['children'][0]['src'];
        $hash = hash('sha256', base64_decode(explode(',', $source, 2)[1]));
        $resolved = BundledArtwork::forSite($entry, $root, 'https://shop.example/custom/plugins/wconvert/');
        self::assertSame(
            'https://shop.example/custom/plugins/wconvert/resources/template-artwork/' . $hash . '.jpg',
            $resolved['tree']['steps'][0]['content']['children'][0]['end'][0]['children'][0]['src']
        );
        self::assertSame($entry, BundledArtwork::forSite($entry, $root, ''));
        self::assertSame($entry, BundledArtwork::forSite($entry, $root . '/missing', 'https://shop.example/'));
    }

    /**
     * Pro's bundled photographs are WebP and live under Pro's own directory; a
     * campaign made from one must carry a cacheable URL, not the photo itself.
     */
    public function testAShippedProWebpBecomesAUrlUnderProsOwnDirectory(): void
    {
        $pro = dirname(__DIR__, 3) . '/pro';
        $json = file_get_contents($pro . '/modules/display-types/templates/polaroid.json');
        self::assertIsString($json);
        $entry = json_decode($json, true);
        $source = $entry['tree']['steps'][0]['content']['children'][0]['children'][0]['src'];
        self::assertStringStartsWith('data:image/webp;base64,', $source);
        $hash = hash('sha256', base64_decode(explode(',', $source, 2)[1]));

        $resolved = BundledArtwork::forSite($entry, $pro, 'https://shop.example/plugins/wconvert-pro/');

        self::assertSame(
            'https://shop.example/plugins/wconvert-pro/resources/template-artwork/' . $hash . '.webp',
            $resolved['tree']['steps'][0]['content']['children'][0]['children'][0]['src']
        );
    }

    public function testHalloweenBackgroundsBecomeLocalWithoutChangingTheirEditableScope(): void
    {
        $root = dirname(__DIR__, 3);
        foreach (['engraved', 'monster', 'forest', 'bats'] as $name) {
            $entry = json_decode((string) file_get_contents($root . '/resources/templates/library/halloween-' . $name . '.json'), true);
            $resolved = BundledArtwork::forSite($entry, $root, 'https://shop.example/custom/wconvert/');
            foreach ($resolved['tree']['steps'] as $step) {
                self::assertStringStartsWith('url("https://shop.example/custom/wconvert/resources/template-artwork/', $step['content']['tokens']['bg-image']);
            }
            self::assertSame($entry, BundledArtwork::forSite($entry, $root, ''));
            self::assertSame($entry, BundledArtwork::forSite($entry, $root . '/missing', 'https://shop.example/'));
            self::assertSame($entry['tree']['fonts'], $resolved['tree']['fonts']);
        }
    }

    public function testUnrecognisedArtworkAndMerchantUrlsAreNeverRewritten(): void
    {
        foreach (['data:image/jpeg;base64,' . base64_encode('unrecognised'), 'https://merchant.example/photo.jpg', 'data:image/jpeg;base64,???'] as $source) {
            $entry = ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => $source]]]]];
            self::assertSame($entry, BundledArtwork::forSite($entry, dirname(__DIR__, 3), 'https://shop.example/'));
        }
    }

    public function testAlteredShippedFileCannotSilentlyReplaceTheReviewedImage(): void
    {
        $root = sys_get_temp_dir() . '/wconvert-artwork-' . bin2hex(random_bytes(5));
        mkdir($root . '/resources/template-artwork', 0777, true);
        $bytes = 'reviewed bytes';
        $file = $root . '/resources/template-artwork/' . hash('sha256', $bytes) . '.jpg';
        file_put_contents($file, 'different bytes');
        $entry = ['tree' => ['steps' => [['content' => ['type' => 'image', 'src' => 'data:image/jpeg;base64,' . base64_encode($bytes)]]]]];
        try {
            self::assertSame($entry, BundledArtwork::forSite($entry, $root, 'https://shop.example/'));
        } finally {
            unlink($file);
            rmdir(dirname($file));
            rmdir($root . '/resources');
            rmdir($root);
        }
    }
}

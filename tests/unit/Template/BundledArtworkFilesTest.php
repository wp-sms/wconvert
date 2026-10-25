<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\TestCase;

/**
 * Every bundled photo is stored once, as a file its design names (ADR 0172).
 *
 * A photo pasted into a design as a data URI rides every preview and every
 * page payload, and is stored twice when its file exists too: that is what
 * made one preview request for three cards weigh 1.5 MB. New photos go in
 * through `tools/design-library/build/extract-artwork.mjs`.
 */
final class BundledArtworkFilesTest extends TestCase
{
    /** Each ZIP: its design folders and the artwork folder they name. */
    private const ZIPS = [
        'free' => ['designs' => ['resources/templates/library'], 'artwork' => 'resources/template-artwork'],
        'pro' => ['designs' => ['pro/modules/*/templates'], 'artwork' => 'pro/resources/template-artwork'],
    ];

    /** @return array<string, array{0: string}> */
    public static function zips(): array
    {
        return ['Free' => ['free'], 'Pro' => ['pro']];
    }

    /** @return array<string, string> file → contents */
    private static function designs(string $zip): array
    {
        $root = dirname(__DIR__, 3);
        $files = [];
        foreach (self::ZIPS[$zip]['designs'] as $pattern) {
            foreach (glob($root . '/' . $pattern . '/*.json') ?: [] as $file) $files[substr($file, strlen($root) + 1)] = (string) file_get_contents($file);
        }
        return $files;
    }

    /** @return list<string> the file names a ZIP's designs reference */
    private static function referenced(string $zip): array
    {
        preg_match_all('/artwork:([a-f0-9]{64}\.(?:webp|png|jpg))/', implode("\n", self::designs($zip)), $matches);
        return array_values(array_unique($matches[1]));
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('zips')]
    public function testNoBundledDesignCarriesARasterAsText(string $zip): void
    {
        $carrying = array_keys(array_filter(self::designs($zip), static fn (string $json): bool => (bool) preg_match('#data:image/(png|jpe?g|webp|gif|avif);base64#', $json)));
        self::assertSame([], $carrying, 'Run node tools/design-library/build/extract-artwork.mjs');
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('zips')]
    public function testEveryNamedFileShipsInItsOwnZipAndIsWhatItsNameSays(string $zip): void
    {
        $directory = dirname(__DIR__, 3) . '/' . self::ZIPS[$zip]['artwork'] . '/';
        self::assertNotSame([], self::referenced($zip), 'Each ZIP ships photos; a glob that finds none is not a pass');
        foreach (self::referenced($zip) as $name) {
            self::assertFileExists($directory . $name);
            self::assertSame(substr($name, 0, 64), hash_file('sha256', $directory . $name), $name);
        }
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('zips')]
    public function testNoArtworkFileIsOrphaned(string $zip): void
    {
        $directory = dirname(__DIR__, 3) . '/' . self::ZIPS[$zip]['artwork'];
        $files = array_map('basename', glob($directory . '/*.{webp,png,jpg}', GLOB_BRACE) ?: []);
        self::assertSame([], array_values(array_diff($files, self::referenced($zip))), 'A file no design names only makes the ZIP bigger');
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('zips')]
    public function testEveryPhotoHasARightsRecord(string $zip): void
    {
        $catalog = json_decode((string) file_get_contents(dirname(__DIR__, 3) . '/tools/design-library/publishing/catalog.json'), true);
        $missing = array_filter(self::referenced($zip), static fn (string $name): bool => !isset($catalog['image_rights'][substr($name, 0, 64)]));
        self::assertSame([], array_values($missing), 'Record the image kind, source, redistribution rights and reviewer in publishing/catalog.json');
    }
}

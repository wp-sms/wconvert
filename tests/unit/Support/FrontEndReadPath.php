<?php

namespace WConvert\Tests\Unit\Support;

use PHPUnit\Framework\Assert;

/**
 * Every file an uncached front-end page load actually runs.
 *
 * ONE list, because two source-reading tests need the same one and **two
 * hand-maintained lists drift, and the drift is silent** — ADR 0012's own
 * words, applied to the tests rather than to the product.
 * {@see \WConvert\Tests\Unit\Frontend\NoSecondCacheTest} asserts this path
 * creates no cache entry (ADR 0003) and
 * {@see \WConvert\Tests\Unit\Contract\NoLicenceOnTheFrontEndTest} asserts it
 * asks no tier question (ADR 0015). A file added to the path and remembered by
 * only one of them is the leak either exists to catch, arriving through the
 * test suite.
 *
 * **Named rather than globbed over one directory**, because the read path is
 * not one directory: it reads the option through `Storage`, parses the set in
 * `Optin`, evaluates the axis in `Targeting`, resolves the asset in `Assets`,
 * and — with [[Pro]] installed — swaps the loader in Pro's own `Frontend`. A
 * transient or an entitlement branch added in any of those is the same mistake
 * as one added in free's `Frontend`.
 */
final class FrontEndReadPath
{
    private const ROOT = __DIR__ . '/../../..';

    /**
     * @return list<string> Absolute paths, every one of which exists.
     */
    public static function files(): array
    {
        $files = array_merge(
            self::glob('src/Frontend/*.php'),
            // Pro's half of the same path. Pro replaces the loader on the same
            // hook (ADR 0014), so its enqueue runs on every uncached page view
            // a premium install serves.
            self::glob('pro/src/Frontend/*.php'),
            self::glob('src/Targeting/*.php'),
            self::named([
                'src/Storage/OptionStore.php',
                'src/Storage/WpOptionStore.php',
                'src/Optin/PublishedSet.php',
                'src/Optin/PublishedOptin.php',
                'src/Assets/BuiltAsset.php',
                // The two site-resolved links, filled in at render time
                // rather than frozen into the published set (ADR 0032,
                // ADR 0025). They run on every uncached page view that
                // carries an Optin, so an entitlement branch or a memo added
                // in either is the same mistake as one added in `Frontend`.
                'src/Template/PolicyLink.php',
                'src/Template/CartLink.php',
            ]),
        );

        Assert::assertNotEmpty($files, 'nothing was inspected, so nothing is proven');

        return $files;
    }

    /**
     * @return list<string>
     */
    private static function glob(string $pattern): array
    {
        $found = glob(self::ROOT . '/' . $pattern) ?: [];

        // A directory that has moved or been emptied leaves a scan looking at
        // nothing, which reads as clean. It is not.
        Assert::assertNotEmpty($found, sprintf('%s matched no files — this check is now looking at nothing', $pattern));

        return $found;
    }

    /**
     * @param list<string> $relative
     * @return list<string>
     */
    private static function named(array $relative): array
    {
        $files = [];

        foreach ($relative as $path) {
            $absolute = self::ROOT . '/' . $path;

            // The failure this catches is a RENAME. Without it, moving
            // `PublishedOptin.php` silently drops it from both scans and
            // every assertion about it starts passing for the wrong reason.
            Assert::assertFileExists($absolute, 'a named read-path file has moved — this check is now looking at nothing');

            $files[] = $absolute;
        }

        return $files;
    }
}

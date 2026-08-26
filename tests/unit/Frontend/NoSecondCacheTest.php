<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;
use WConvert\Tests\Unit\Support\PhpSource;

/**
 * There is deliberately no per-URL cache under the front-end read path.
 *
 * ADR 0003 says it plainly — *"Every WordPress developer's instinct is to add
 * one; don't"* — and an instinct that strong is not held off by a comment. The
 * full-page cache is the cache; a transient keyed by URL would cache something
 * already cached and add an invalidation surface that will eventually be
 * wrong, and a transient can be evicted, which lands a cold DB query on an
 * uncached page load.
 *
 * This reads the source rather than the behaviour on purpose: the failure it
 * guards against is a line someone ADDS, and no assertion about output can see
 * a cache that is working correctly.
 */
#[CoversNothing]
final class NoSecondCacheTest extends TestCase
{
    private const SRC = __DIR__ . '/../../../src';

    /**
     * Every file an uncached front-end page load actually runs.
     *
     * Named rather than globbed over one directory: the read path is not one
     * directory. It reads the option through `Storage`, parses the set in
     * `Optin`, and evaluates the axis in `Targeting`, and a transient added in
     * any of those three is the same mistake as one added in `Frontend`.
     *
     * @return list<string>
     */
    private function readPathSources(): array
    {
        $files = array_merge(
            glob(self::SRC . '/Frontend/*.php') ?: [],
            glob(self::SRC . '/Targeting/*.php') ?: [],
            [
                self::SRC . '/Storage/OptionStore.php',
                self::SRC . '/Storage/WpOptionStore.php',
                self::SRC . '/Optin/PublishedSet.php',
                self::SRC . '/Optin/PublishedOptin.php',
                self::SRC . '/Assets/BuiltAsset.php',
            ],
        );

        $this->assertNotEmpty($files, 'nothing was inspected, so nothing is proven');

        foreach ($files as $file) {
            $this->assertFileExists($file, 'a named read-path file has moved — this check is now looking at nothing');
        }

        return $files;
    }

    public function testTheFrontEndReadPathCreatesNoCacheEntry(): void
    {
        $forbidden = [
            'set_transient',
            'set_site_transient',
            'get_transient',
            'get_site_transient',
            'wp_cache_set',
            'wp_cache_add',
            'wp_cache_get',
        ];

        foreach ($this->readPathSources() as $file) {
            // Comments stripped first: these files explain at length why they
            // do not call any of this, and the explanation must not read as
            // the violation.
            $code = PhpSource::code($file);

            foreach ($forbidden as $call) {
                $this->assertStringNotContainsString(
                    $call,
                    $code,
                    sprintf('%s calls %s() on the front-end read path', basename($file), $call)
                );
            }
        }
    }

}

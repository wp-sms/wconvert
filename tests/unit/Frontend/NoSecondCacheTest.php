<?php

namespace WConvert\Tests\Unit\Frontend;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

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
    private const READ_PATH = __DIR__ . '/../../../src/Frontend';

    /**
     * @return list<string>
     */
    private function readPathSources(): array
    {
        $files = glob(self::READ_PATH . '/*.php') ?: [];

        $this->assertNotEmpty($files, 'nothing was inspected, so nothing is proven');

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
            $source = (string) file_get_contents($file);

            // Strip comments first: these files explain at length why they do
            // not call any of this, and the explanation must not read as the
            // violation.
            $code = self::stripComments($source);

            foreach ($forbidden as $call) {
                $this->assertStringNotContainsString(
                    $call,
                    $code,
                    sprintf('%s calls %s() on the front-end read path', basename($file), $call)
                );
            }
        }
    }

    private static function stripComments(string $source): string
    {
        $code = '';

        foreach (token_get_all($source) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }

            $code .= is_array($token) ? $token[1] : $token;
        }

        return $code;
    }
}

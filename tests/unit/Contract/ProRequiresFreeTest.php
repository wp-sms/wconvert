<?php

namespace WConvert\Tests\Unit\Contract;

use PHPUnit\Framework\Attributes\CoversNothing;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../bin/plugin-identity.php';

/**
 * Pro's header names free as a required plugin (ADR 0193).
 *
 * That one line is what makes WordPress grey out free's Deactivate link while
 * Pro is active and refuse to activate Pro without free. Nothing else in the
 * code depends on it, so dropping it would pass every other test and bring back
 * "my popups vanished".
 */
#[CoversNothing]
final class ProRequiresFreeTest extends TestCase
{
    public function testProDeclaresFreeAsItsOnlyRequiredPlugin(): void
    {
        $header = (string) file_get_contents(dirname(__DIR__, 3) . '/pro/wconvert-pro.php', false, null, 0, 8192);

        // WordPress's own reading of the header: get_file_data()'s pattern, and
        // wp_plugin_dependencies' comma split.
        $this->assertSame(1, preg_match_all('/^[ \t\/*#@]*Requires Plugins:(.*)$/mi', $header, $matches));
        $slugs = array_map('trim', explode(',', trim($matches[1][0])));

        $this->assertSame([WCONVERT_PLUGINS['wconvert.php']['slug']], $slugs);
    }
}

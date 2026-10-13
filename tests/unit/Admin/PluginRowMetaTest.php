<?php

namespace WConvert\Tests\Unit\Admin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Admin\PluginRowMeta;

/**
 * Docs and Support under the plugin's own row, and nobody else's (ADR 0145).
 */
#[CoversClass(PluginRowMeta::class)]
final class PluginRowMetaTest extends TestCase
{
    public function testItAddsDocsAndSupportToItsOwnRowInANewTab(): void
    {
        $meta = (new PluginRowMeta('wconvert/wconvert.php'))->links(['Version 1.0.0'], 'wconvert/wconvert.php');

        $this->assertSame('Version 1.0.0', $meta[0], 'WordPress\'s own row meta stays first');
        $this->assertStringContainsString('href="https://wconvert.io/docs/" target="_blank"', $meta['wconvert-docs']);
        $this->assertStringContainsString('href="https://wconvert.io/support/" target="_blank"', $meta['wconvert-support']);
    }

    public function testAnotherPluginsRowIsLeftAlone(): void
    {
        $this->assertSame(['Version 2'], (new PluginRowMeta('wconvert/wconvert.php'))->links(['Version 2'], 'akismet/akismet.php'));
    }
}

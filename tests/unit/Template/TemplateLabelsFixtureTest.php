<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Template\TemplateLabels;

/**
 * The admin tests' label fixtures are `TemplateLabels::all()`, not a second
 * hand-written spelling of it — so a renamed label (ADR 0133's word list)
 * cannot leave a test asserting the old word.
 *
 * Regenerate after changing a label:
 *
 *     php -r 'require "tests/bootstrap.php"; file_put_contents("tests/fixtures/template-labels.json",
 *       json_encode(WConvert\Template\TemplateLabels::all(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");'
 */
#[CoversClass(TemplateLabels::class)]
final class TemplateLabelsFixtureTest extends TestCase
{
    public function testTheFixtureIsTheLabels(): void
    {
        $fixture = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/template-labels.json'), true, 512, JSON_THROW_ON_ERROR);

        $this->assertSame(TemplateLabels::all(), $fixture, 'tests/fixtures/template-labels.json is stale: regenerate it (see this test).');
    }
}

<?php

namespace WConvert\Tests\Unit\Template;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\OptinBinding;
use WConvert\Template\CaptureContract;
use WConvert\Template\PolicyLink;
use WConvert\Tests\Unit\Support\JourneyFixture;

/**
 * The server's half of three rules the admin also spells (ADR 0133). The
 * cases live in `tests/fixtures/link-and-capture-rules.json`, which
 * `tests/js/link-and-capture-parity.test.ts` reads too, so the two cannot drift.
 */
#[CoversClass(PolicyLink::class)]
#[CoversClass(CaptureContract::class)]
#[CoversClass(OptinBinding::class)]
final class LinkAndCaptureParityTest extends TestCase
{
    /** @return array<string, mixed> */
    private static function fixture(): array
    {
        /** @var array<string, mixed> $decoded */
        $decoded = json_decode((string) file_get_contents(dirname(__DIR__, 2) . '/fixtures/link-and-capture-rules.json'), true, 512, JSON_THROW_ON_ERROR);

        return $decoded;
    }

    /**
     * @param array<string, mixed> $node
     * @return array<string, mixed>
     */
    private static function config(array $node): array
    {
        return ['template' => ['tree' => JourneyFixture::tree(['steps' => [['type' => 'stack', 'children' => [
            $node,
            ['type' => 'button', 'action' => 'link', 'href' => 'https://example.test/', 'label' => 'Go'],
        ]]]])]];
    }

    public function testLinksResolveAndBlockAsTheFixtureSays(): void
    {
        $fixture = self::fixture();

        foreach ($fixture['links'] as $case) {
            $resolved = PolicyLink::into(self::config($case['node']), $fixture['policy']);
            $link = $resolved['template']['tree']['steps'][0]['content']['children'][0]['link'];

            $this->assertSame($case['resolved'], $link['href'] ?? null, $case['why']);
            $this->assertSame($case['unfinished'], CaptureContract::hasUnfinishedLink($case['node']), $case['why']);
        }
    }

    public function testCaptureModeIsReadAsTheFixtureSays(): void
    {
        foreach (self::fixture()['captureModes'] as $case) {
            $this->assertSame($case['mode'], OptinBinding::captureMode($case['config']), $case['why']);
        }
    }
}

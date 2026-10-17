<?php

namespace WConvert\Tests\Unit\Optin;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Optin\OptinState;
use WConvert\Optin\ConfigRevision;
use WConvert\Optin\Optin;

/** The PHP twin of `statusOf()`, the schedule phase beside it, and the draft's revision. */
#[CoversClass(OptinState::class)]
#[CoversClass(ConfigRevision::class)]
final class OptinStateTest extends TestCase
{
    public function testStatusOverridesInTheListsOrder(): void
    {
        self::assertSame('draft', OptinState::status(null, null, false));
        self::assertSame('published', OptinState::status('2026-11-01 00:00:00', null, false));
        self::assertSame('suspended', OptinState::status('2026-11-01 00:00:00', null, true));
        self::assertSame('deleted', OptinState::status('2026-11-01 00:00:00', '2026-11-02 00:00:00', true));
    }

    public function testPhaseReadsTheLoadersHalfOpenWindow(): void
    {
        $utc = new \DateTimeZone('UTC');
        $config = ['starts_at' => '2026-11-20 00:00', 'ends_at' => '2026-12-02 00:00'];

        self::assertSame('always', OptinState::phase([], $utc));
        self::assertSame('not_started', OptinState::phase($config, $utc, strtotime('2026-11-19 23:59 UTC')));
        self::assertSame('running', OptinState::phase($config, $utc, strtotime('2026-11-20 00:00 UTC')));
        self::assertSame('ended', OptinState::phase($config, $utc, strtotime('2026-12-02 00:00 UTC')));
        self::assertSame('running', OptinState::phase(['starts_at' => '2026-11-20 00:00'], $utc, strtotime('2030-01-01 UTC')));
    }

    public function testTheRevisionChangesWithTheDraftAndNothingElse(): void
    {
        $draft = new Optin('01J00000000000000000000000', 'Black Friday bar', 'promote_offer', ['display_type' => 'floating_bar']);
        $published = new Optin('01J00000000000000000000000', 'Black Friday bar', 'promote_offer', ['display_type' => 'floating_bar'], ['display_type' => 'popup'], '2026-11-01 00:00:00');
        $renamed = new Optin('01J00000000000000000000000', 'Cyber Monday bar', 'promote_offer', ['display_type' => 'floating_bar']);

        self::assertSame(16, strlen(ConfigRevision::of($draft)));
        self::assertSame(ConfigRevision::of($draft), ConfigRevision::of($published));
        self::assertNotSame(ConfigRevision::of($draft), ConfigRevision::of($renamed));
    }
}

<?php
namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Destination\SubmissionDispatcher;

/**
 * The hourly recovery sweep is scheduled on `init`, not on `plugins_loaded`.
 *
 * wp_schedule_event() reads wp_get_schedules(), and WooCommerce's
 * `cron_schedules` filter translates its schedule names. Called before
 * `init`, that loads WooCommerce's translations too early and WordPress
 * logs a _load_textdomain_just_in_time notice (WordPress.org review,
 * round 2).
 */
#[CoversClass(SubmissionDispatcher::class)]
final class SubmissionDispatcherScheduleTest extends TestCase
{
    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestSchedule'] = [];
    }

    /** Scheduling needs no dispatcher, so asking for one fails the test. */
    private static function hooks(): void
    {
        SubmissionDispatcher::hooks(static fn (): SubmissionDispatcher => throw new \LogicException('scheduling built the dispatcher'));
    }

    public function testBootingSchedulesNothingBeforeInit(): void
    {
        self::hooks();

        self::assertFalse(wp_next_scheduled(SubmissionDispatcher::RECOVER));
    }

    public function testInitSchedulesTheSweepOnce(): void
    {
        self::hooks();
        do_action('init');
        $first = wp_next_scheduled(SubmissionDispatcher::RECOVER);
        do_action('init');

        self::assertIsInt($first);
        self::assertSame($first, wp_next_scheduled(SubmissionDispatcher::RECOVER));
    }
}

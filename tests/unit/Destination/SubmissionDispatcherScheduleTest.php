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
    private SubmissionDispatcher $dispatcher;

    protected function setUp(): void
    {
        $GLOBALS['wconvertTestActions'] = [];
        $GLOBALS['wconvertTestSchedule'] = [];
        // hooks() and schedule() touch none of the five collaborators.
        $this->dispatcher = (new \ReflectionClass(SubmissionDispatcher::class))->newInstanceWithoutConstructor();
    }

    public function testBootingSchedulesNothingBeforeInit(): void
    {
        $this->dispatcher->hooks();

        self::assertFalse(wp_next_scheduled(SubmissionDispatcher::RECOVER));
    }

    public function testInitSchedulesTheSweepOnce(): void
    {
        $this->dispatcher->hooks();
        do_action('init');
        $first = wp_next_scheduled(SubmissionDispatcher::RECOVER);
        do_action('init');

        self::assertIsInt($first);
        self::assertSame($first, wp_next_scheduled(SubmissionDispatcher::RECOVER));
    }
}

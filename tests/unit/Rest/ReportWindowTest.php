<?php
namespace WConvert\Tests\Unit\Rest;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Rest\ReportWindow;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;

/**
 * The one calendar contract every report route reads (dashboard, journey,
 * product and order reports), so custom dates mean the same window on each.
 */
#[CoversClass(ReportWindow::class)]
final class ReportWindowTest extends TestCase
{
    /** @param array<string, mixed> $params */
    private static function request(array $params): \WP_REST_Request
    {
        $request = new \WP_REST_Request();
        foreach ($params as $key => $value) $request->set_param($key, $value);

        return $request;
    }

    public function testEveryRouteAcceptsCustomDatesBesideDaysAndMonth(): void
    {
        $args = ReportWindow::args(true);

        self::assertSame(['complete', 'month', 'days', 'from', 'to'], array_keys($args));
        self::assertTrue($args['complete']['default']);
        self::assertSame($args['from'], $args['to']);
    }

    public function testCustomDatesTakePrecedenceOverMonthAndDays(): void
    {
        $request = self::request(['from' => '2026-01-05', 'to' => '2026-01-11', 'month' => '2026-02', 'days' => 30, 'complete' => true]);
        $range = ReportWindow::read($request);

        self::assertSame(['2026-01-05', '2026-01-11'], [$range->from, $range->to]);
        self::assertTrue(ReportWindow::custom($request));
        self::assertTrue(ReportWindow::complete($request, $range));
    }

    /** A custom range ending today includes today so far, so it is not complete days. */
    public function testACustomRangeIsCompleteOnlyWhenItEndsBeforeToday(): void
    {
        $request = self::request(['from' => StatDay::today(), 'to' => StatDay::today()]);

        self::assertFalse(ReportWindow::complete($request, ReportWindow::read($request)));
    }

    /** One end alone is a custom range missing the other, never silently a rolling window. */
    public function testOneEndAloneIsRefused(): void
    {
        $request = self::request(['from' => '2026-01-05', 'days' => 7]);

        self::assertTrue(ReportWindow::custom($request));
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionCode(StatRange::INVALID_DAY);
        ReportWindow::read($request);
    }

    public function testRollingAndMonthWindowsAreUnchanged(): void
    {
        $complete = self::request(['days' => 7, 'complete' => true]);
        $live = self::request(['days' => 1]);
        $month = self::request(['month' => '2024-02', 'days' => 7]);

        self::assertEquals(StatRange::completeDays(7, StatDay::today()), ReportWindow::read($complete));
        self::assertEquals(StatRange::lastDays(1, StatDay::today()), ReportWindow::read($live));
        self::assertSame(['2024-02-01', '2024-02-29'], [ReportWindow::read($month)->from, ReportWindow::read($month)->to]);
        self::assertTrue(ReportWindow::complete($complete, ReportWindow::read($complete)));
        self::assertFalse(ReportWindow::complete($live, ReportWindow::read($live)));
        self::assertTrue(ReportWindow::complete($month, ReportWindow::read($month)));
    }

    /** @return iterable<string, array{int, string}> */
    public static function refusals(): iterable
    {
        yield 'month' => [StatRange::INVALID_MONTH, 'Choose a current or earlier calendar month.'];
        yield 'day' => [StatRange::INVALID_DAY, 'Choose two calendar days.'];
        yield 'reversed' => [StatRange::REVERSED, 'The first day comes after the last.'];
        yield 'after today' => [StatRange::AFTER_TODAY, 'The last day can’t be after today.'];
        yield 'too long' => [StatRange::TOO_LONG, 'Choose a shorter range: 366 days at most.'];
    }

    /** Each refusal is said in the picker's own words, as a 400 the screen can show. */
    #[\PHPUnit\Framework\Attributes\DataProvider('refusals')]
    public function testEveryRefusalIsWorded(int $code, string $message): void
    {
        $error = ReportWindow::error(new \InvalidArgumentException('', $code));

        self::assertSame('wconvert_report_range', $error->get_error_code());
        self::assertSame($message, $error->get_error_message());
        self::assertSame(400, $error->get_error_data()['status']);
    }
}

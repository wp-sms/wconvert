<?php
namespace WConvert\Rest;

use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;
use WP_REST_Request;

defined('ABSPATH') || exit;

/**
 * Shared calendar contract for campaign, journey and order reporting.
 *
 * A window is named one of three ways, in this order of precedence: two days
 * the merchant typed (`from` and `to`, ADR 0132), a calendar month (ADR 0090),
 * or a number of days ending today or — with `complete` — yesterday
 * (ADR 0089). Every one of them is capped by {@see StatDay::today()}, read
 * here on the server; no parameter carries the browser's idea of today.
 */
final class ReportWindow
{
    /** @return array<string, array<string, mixed>> */
    public static function args(bool $complete = false): array
    {
        // The pattern is the shape; StatRange::between() checks the calendar.
        $day = ['type' => 'string', 'pattern' => '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'];

        return ['complete' => ['type' => 'boolean', 'default' => $complete],
            'month' => ['type' => 'string', 'pattern' => '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'],
            'days' => ['type' => 'integer', 'default' => StatRange::DEFAULT_DAYS, 'minimum' => 1, 'maximum' => StatRange::MAX_DAYS],
            'from' => $day,
            'to' => $day];
    }

    /** @throws \InvalidArgumentException with a {@see StatRange} code; {@see self::error()} words it. */
    public static function read(WP_REST_Request $request): StatRange
    {
        if (self::custom($request)) {
            return StatRange::between((string) $request->get_param('from'), (string) $request->get_param('to'), StatDay::today());
        }
        $month = $request->get_param('month');
        if (is_string($month) && $month !== '') return StatRange::calendarMonth($month, StatDay::today());
        $days = $request->get_param('days') ?? StatRange::DEFAULT_DAYS;
        return $request->get_param('complete') ? StatRange::completeDays((int) $days, StatDay::today()) : StatRange::lastDays((int) $days, StatDay::today());
    }

    /** Whether the caller named its own days. Either one alone is a custom range missing an end. */
    public static function custom(WP_REST_Request $request): bool
    {
        $from = $request->get_param('from');
        $to = $request->get_param('to');

        return (is_string($from) && $from !== '') || (is_string($to) && $to !== '');
    }

    /**
     * A custom range counts complete days only when it ends before today:
     * ending on today makes it live, like the Today choice (ADR 0132).
     */
    public static function complete(WP_REST_Request $request, StatRange $range): bool
    {
        if (self::custom($request)) return $range->to < StatDay::today();
        $month = $request->get_param('month');

        return (bool) $request->get_param('complete') || (is_string($month) && $month !== '');
    }

    /** One refusal for every report route, in the words the date picker uses. */
    public static function error(\InvalidArgumentException $refusal): \WP_Error
    {
        $message = match ($refusal->getCode()) {
            StatRange::INVALID_DAY => __('Choose two calendar days.', 'wconvert'),
            StatRange::REVERSED => __('The first day comes after the last.', 'wconvert'),
            StatRange::AFTER_TODAY => __('The last day can’t be after today.', 'wconvert'),
            StatRange::TOO_LONG => sprintf(
                /* translators: %s: the longest report window in days, e.g. 366. */
                __('Choose a shorter range: %s days at most.', 'wconvert'),
                number_format_i18n(StatRange::MAX_DAYS)
            ),
            default => __('Choose a current or earlier calendar month.', 'wconvert'),
        };

        return new \WP_Error('wconvert_report_range', $message, ['status' => 400]);
    }
}

<?php
namespace WConvert\Rest;

use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;
use WP_REST_Request;

defined('ABSPATH') || exit;

/** Shared calendar contract for campaign, journey and order reporting. */
final class ReportWindow
{
    /** @return array<string, array<string, mixed>> */
    public static function args(bool $complete = false): array
    {
        return ['complete' => ['type' => 'boolean', 'default' => $complete],
            'month' => ['type' => 'string', 'pattern' => '^[1-9][0-9]{3}-(0[1-9]|1[0-2])$'],
            'days' => ['type' => 'integer', 'default' => StatRange::DEFAULT_DAYS, 'minimum' => 1, 'maximum' => StatRange::MAX_DAYS]];
    }

    public static function read(WP_REST_Request $request): StatRange
    {
        $month = $request->get_param('month');
        if (is_string($month) && $month !== '') return StatRange::calendarMonth($month, StatDay::today());
        $days = $request->get_param('days') ?? StatRange::DEFAULT_DAYS;
        return $request->get_param('complete') ? StatRange::completeDays((int) $days, StatDay::today()) : StatRange::lastDays((int) $days, StatDay::today());
    }
}

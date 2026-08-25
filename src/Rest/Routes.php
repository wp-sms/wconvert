<?php

namespace WConvert\Rest;

defined('ABSPATH') || exit;

/**
 * What every WConvert REST route shares: one namespace, one permission.
 *
 * Both are here rather than on whichever controller happened to be written
 * first. A second controller reaching for `OptinController::NAMESPACE` reads
 * as though Optins own the namespace, and the day a third route wants a
 * different capability the answer should be a change to this file rather than
 * a divergence nobody notices.
 *
 * @since 0.1.0
 */
final class Routes
{
    public const NAMESPACE = 'wconvert/v1';

    /**
     * Everything WConvert exposes is an administration surface, so one
     * capability covers all of it. The capture endpoint is the exception and
     * is public by nature — it arrives with capture, and it will say so.
     */
    public static function canManage(): bool
    {
        return current_user_can('manage_options');
    }
}

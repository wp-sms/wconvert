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
     * capability covers all of it — with exactly one exception,
     * {@see self::canCapture()} below.
     */
    public static function canManage(): bool
    {
        return current_user_can('manage_options');
    }

    /**
     * The capture endpoint, and it is public **by nature**.
     *
     * The visitor filling in a popup is not logged in and has no capability to
     * check. A nonce is no substitute either: the payload is baked into HTML
     * the full-page cache serves byte-identically to everyone, so a nonce in
     * it is the same nonce for every visitor for the cache's lifetime and
     * authenticates nothing (ADR 0004).
     *
     * So this returns true, deliberately and permanently, and the protection
     * lives where it can actually hold — in
     * {@see \WConvert\Rest\CaptureController} re-reading everything about the
     * form from the server's own published copy, and trusting the client for
     * nothing but the values a person typed.
     */
    public static function canCapture(): bool
    {
        return true;
    }
}

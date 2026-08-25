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
     * capability covers all of it — with exactly two exceptions,
     * {@see self::canCapture()} and {@see self::canBeacon()} below. Both are
     * public for the same structural reason and neither is public by
     * omission.
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

    /**
     * The analytics beacon, and it is public for the same reason and one more.
     *
     * The same reason: it fires from a page the full-page cache serves
     * byte-identically to every visitor, so a nonce in it is the same nonce for
     * everyone for the cache's lifetime and authenticates nothing (ADR 0004).
     *
     * The one more: **the beacon is stateless**, so there is nothing here to
     * authenticate. It carries no visitor id, no device id and no hashed
     * fingerprint, because WConvert mints none (ADR 0017) — what arrives is an
     * Optin id that is already public and one of three words.
     *
     * What that leaves is hardening rather than authentication, and it is
     * light and deliberate: the id is validated against the published set, the
     * IP is hashed into a short-lived transient as a rate limit, and prefetch,
     * prerender and bot traffic is dropped. It stops there, because what abuse
     * costs is a wrong number on one merchant's dashboard rather than data loss
     * or a breach (ADR 0019).
     */
    public static function canBeacon(): bool
    {
        return true;
    }
}

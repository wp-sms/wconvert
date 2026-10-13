<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * The guides the PHP side links to, by slug (ADR 0145). The admin's twin is
 * `resources/admin/src/shell/docs.ts`; both name only articles that exist on
 * wconvert.io's `docs.ts`.
 *
 * @since 1.0.0
 */
final class Docs
{
    public const URL = 'https://wconvert.io/docs/';

    public const SUPPORT = 'https://wconvert.io/support/';

    public const POPUP_NOT_SHOWING = 'popup-not-showing';

    public const UPDATE = 'update-wconvert';

    public const WEBHOOKS = 'webhooks';

    /** A guide's address, optionally at one of its section ids. */
    public static function url(string $guide = '', string $section = ''): string
    {
        return self::URL . ($guide !== '' ? $guide . '/' : '') . ($section !== '' ? '#' . $section : '');
    }
}

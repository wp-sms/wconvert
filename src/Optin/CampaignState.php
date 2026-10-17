<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * Where a campaign stands, as the admin list reads it: the PHP twin of
 * `statusOf()` in `resources/admin/src/optins/api.ts`, plus where today falls
 * in its schedule.
 *
 * Computed on every read and stored nowhere, for the reason suspension is
 * (ADR 0027): each input is already a fact the site holds.
 */
final class CampaignState
{
    /** `draft`, `published`, `suspended` or `deleted`, overriding in that order from the right. */
    public static function status(?string $publishedAt, ?string $deletedAt, bool $suspended): string
    {
        if ($deletedAt !== null) return 'deleted';
        if ($publishedAt === null) return 'draft';
        return $suspended ? 'suspended' : 'published';
    }

    /**
     * `always` with no dates, else `not_started`, `running` or `ended` — against
     * the loader's half-open window, `starts_at <= now < ends_at`.
     *
     * @param array<string, mixed> $config Anything carrying `starts_at` and `ends_at` wall times.
     * @param int|null $now Seconds; the current time when null.
     */
    public static function phase(array $config, \DateTimeZone $zone, ?int $now = null): string
    {
        $window = Schedule::windowIn($config, $zone);
        if ($window === []) return 'always';
        $at = ($now ?? time()) * 1000;
        if (isset($window['starts_at']) && $at < $window['starts_at']) return 'not_started';
        if (isset($window['ends_at']) && $at >= $window['ends_at']) return 'ended';
        return 'running';
    }
}

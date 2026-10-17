<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * The schedule a campaign made inside an occasion starts with: the PHP twin
 * of `occasionSchedule()` in `resources/admin/src/lib/occasion.ts`.
 *
 * An occasion's dates are inclusive days and a campaign's end is exclusive,
 * so Black Friday 20 Nov – 1 Dec is `2026-11-20 00:00` to `2026-12-02 00:00`
 * (ADR 0149 §3).
 */
final class OccasionSchedule
{
    /** @return array{starts_at: string, ends_at: string} */
    public static function of(string $start, string $end): array
    {
        $after = (new \DateTimeImmutable($end . ' 00:00', new \DateTimeZone('UTC')))->modify('+1 day')->format('Y-m-d');
        return ['starts_at' => $start . ' 00:00', 'ends_at' => $after . ' 00:00'];
    }
}

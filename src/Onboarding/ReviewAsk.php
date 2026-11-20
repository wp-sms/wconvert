<?php

namespace WConvert\Onboarding;

defined('ABSPATH') || exit;

/**
 * Whether to ask one user for a wordpress.org review, and which look to show
 * (ADR 0191).
 *
 * ```
 * no first conversion yet       → null
 * first conversion, never asked → 'first'  (Rate / Maybe later / No thanks)
 * Maybe later                   → null for 30 days, then 'last' (Rate / No thanks)
 * Rate or No thanks             → null for good
 * ```
 *
 * **Per user, in user meta**, like {@see ChecklistDismissal}: two admins on one
 * site each decide for themselves. The value is `''`, `later:<unix>` or `done`.
 *
 * The first conversion is passed in as a callable so the stats scan only runs
 * for a user who has never answered. Once they have, the stored value alone
 * settles it. The scan itself is cached by {@see self::firstConversion()}.
 */
final class ReviewAsk
{
    /** Suffixed with the blog id: one user spans every site of a network. */
    public const META = 'wconvert_review_ask_';

    /** Developer-only: return false for agencies and white-label builds. */
    public const FILTER = 'wconvert_ask_for_review';

    /** How long "Maybe later" hides the card. */
    public const WAIT = 30 * 86400;

    public const CHOICES = ['rated', 'later', 'declined'];

    /** The site's first conversion day, or '' for none yet: {@see self::firstConversion()}. */
    public const CACHE = 'wconvert_first_conversion';

    private const DONE = 'done';
    private const LATER = 'later:';

    /**
     * @param callable(): ?string $firstConversion The `Y-m-d` of the site's first conversion, or null.
     * @return 'first'|'last'|null
     */
    public function state(int $userId, callable $firstConversion, int $now): ?string
    {
        // Spelled out rather than self::FILTER, so Plugin Check can see the prefix.
        if ($userId <= 0 || !(bool) apply_filters('wconvert_ask_for_review', true)) {
            return null;
        }

        $stored = self::stored($userId);

        if ($stored === self::DONE) {
            return null;
        }

        if (str_starts_with($stored, self::LATER)) {
            $since = (int) substr($stored, strlen(self::LATER));

            return $now >= $since + self::WAIT ? 'last' : null;
        }

        return $firstConversion() === null ? null : 'first';
    }

    /**
     * "Maybe later" is offered once. A second one, which only a stale page
     * could send, counts as No thanks.
     */
    public function record(int $userId, string $choice, int $now): void
    {
        if ($userId <= 0 || !in_array($choice, self::CHOICES, true)) {
            return;
        }

        $value = $choice === 'later' && !str_starts_with(self::stored($userId), self::LATER)
            ? self::LATER . $now
            : self::DONE;

        update_user_meta($userId, self::key(), $value);
    }

    /**
     * The site's first conversion day, scanning the stats table at most once
     * an hour until there is one and never again after.
     *
     * The scan is `MIN(stat_date)` over every counter row (309 ms at 1.32M
     * rows, ADR 0140), and the boot flag asks on every WConvert screen load
     * for anyone who hasn't answered. A first day never changes once found,
     * so it is kept without expiry; "none yet" is kept for an hour, which is
     * the longest the card can lag a site's first conversion.
     *
     * A transient, not a table or column: no schema changes (ADR 0191).
     *
     * @param callable(): ?string $scan
     */
    public static function firstConversion(callable $scan): ?string
    {
        $cached = get_transient(self::CACHE);

        if (is_string($cached)) {
            return $cached === '' ? null : $cached;
        }

        $day = $scan();
        set_transient(self::CACHE, $day ?? '', $day === null ? HOUR_IN_SECONDS : 0);

        return $day;
    }

    public static function key(): string
    {
        return self::META . get_current_blog_id();
    }

    private static function stored(int $userId): string
    {
        $value = get_user_meta($userId, self::key(), true);

        return is_string($value) ? $value : '';
    }
}

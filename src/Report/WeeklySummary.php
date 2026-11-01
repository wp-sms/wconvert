<?php

namespace WConvert\Report;

defined('ABSPATH') || exit;

/**
 * What the weekly summary email says, worked out from one analytics report
 * (ADR 0176).
 *
 * It reads {@see \WConvert\Stats\Dashboard::compare()} over the last seven
 * complete site days, so every number in the email is one the Analytics
 * screen shows for the same week. It reads no other store, and it holds
 * **aggregate counts and campaign names only**: no Lead, no address, nothing
 * about a visitor.
 *
 * Pure: the caller passes the report, the first-publish day and the links in,
 * so the content and the skip rules are tested without WordPress.
 */
final class WeeklySummary
{
    public const SKIP_NOT_PUBLISHED = 'not_published';

    public const SKIP_NOTHING_SHOWN = 'nothing_shown';

    /** The result groups an email can lead with, in order of preference. */
    private const GROUPS = ['leads', 'offers', 'carts', 'additions'];

    /**
     * Why a scheduled summary would not be sent, or null to send it.
     *
     * A test send ignores this: its job is to show the layout.
     *
     * @param array<string, mixed> $report
     */
    public static function skipReason(array $report, ?string $firstPublish): ?string
    {
        if ($firstPublish === null) {
            return self::SKIP_NOT_PUBLISHED;
        }

        if (self::count($report, 'impressions') === 0) {
            return self::SKIP_NOTHING_SHOWN;
        }

        return null;
    }

    /**
     * @param array<string, mixed> $report A {@see \WConvert\Stats\Dashboard::compare()} payload.
     * @param string $adminUrl `admin.php?page=wconvert`, absolute.
     * @return array{subject: string, preheader: string, eyebrow: string, headline: string, lede: string, tiles: list<array{label: string, value: string, change: string, tone: string}>, best: ?array{eyebrow: string, title: string, body: string}, insight: ?array{eyebrow: string, title: string, body: string}, actions: list<array{label: string, url: string}>, site: string, footer: array{note: string, reason: string, link: string, url: string}}
     */
    public static function compose(array $report, ?string $firstPublish, string $site, string $adminUrl, bool $test = false): array
    {
        $group = self::leadingGroup($report);
        // The first summary after the first publish says "First week": either
        // the publish fell in this window, or it fell in the one before and
        // that week showed nothing, so the week before was skipped.
        $firstWeek = $firstPublish !== null && ($firstPublish >= (string) ($report['from'] ?? '')
            || ($firstPublish >= (string) ($report['previous']['from'] ?? '9999') && self::count($report['previous'] ?? [], 'impressions') === 0));
        $hasPrevious = !$firstWeek && is_array($report['previous'] ?? null);
        $published = self::published($report);

        $shown = self::count($report, 'impressions');
        $shownBefore = $hasPrevious ? self::count($report['previous'], 'impressions') : null;

        $tiles = [self::tile(self::label($report, 'impressions', __('Shown', 'wconvert')), number_format_i18n($shown), $firstWeek, $shown, $shownBefore)];

        if ($group === null) {
            // Only "Show a message" campaigns: nothing converts (ADR 0163).
            /* translators: %s: how many times campaigns were shown. */
            $phrase = sprintf(_n('Shown %s time', 'Shown %s times', $shown, 'wconvert'), number_format_i18n($shown));
            $change = self::percent($shown, $shownBefore);
        } else {
            $results = self::count($report, $group);
            $before = $hasPrevious ? self::count($report['previous'], $group) : null;
            $phrase = self::resultsPhrase($group, $results);
            $change = self::percent($results, $before);
            $groupShown = self::groupImpressions($report, $group);
            $rate = $groupShown === 0 ? null : $results / $groupShown;
            $rateBefore = null;

            if ($hasPrevious) {
                $previousShown = self::groupImpressions($report['previous'], $group);
                $rateBefore = $previousShown === 0 ? null : self::count($report['previous'], $group) / $previousShown;
            }

            $tiles[] = self::tile(self::label($report, $group, $group), number_format_i18n($results), $firstWeek, $results, $before);
            $tiles[] = [
                'label' => self::rateLabel($group),
                'value' => $rate === null ? '–' : self::rate($rate),
                'change' => $firstWeek ? __('First week', 'wconvert') : self::pointsChange($rate, $rateBefore),
                'tone' => $firstWeek || $rate === null || $rateBefore === null ? 'flat' : self::tone($rate - $rateBefore),
            ];
        }

        $campaigns = sprintf(
            /* translators: %s: a number of campaigns. */
            _n('%s published campaign', '%s published campaigns', count($published), 'wconvert'),
            number_format_i18n(count($published))
        );

        if ($firstWeek) {
            /* translators: %s: e.g. “12 submissions”. */
            $headline = sprintf(__('%s in your first week', 'wconvert'), $phrase);
            $lede = count($published) === 1
                /* translators: 1: a campaign's name, 2: a weekday, e.g. “Tuesday”. */
                ? sprintf(__('%1$s went live on %2$s. Next Monday’s summary compares with this week.', 'wconvert'), $published[0], self::weekday($firstPublish))
                : __('Your campaigns went live this week. Next Monday’s summary compares with this week.', 'wconvert');
            /* translators: 1: e.g. “12 submissions”, 2: the site's name. */
            $subject = sprintf(__('Your first week: %1$s · %2$s', 'wconvert'), $phrase, $site);
        } else {
            /* translators: %s: e.g. “96 submissions”. */
            $headline = sprintf(__('%s last week', 'wconvert'), $phrase);
            $lede = self::lede($change, $campaigns);
            $subject = $change === null
                /* translators: 1: e.g. “96 submissions”, 2: the site's name. */
                ? sprintf(__('%1$s last week · %2$s', 'wconvert'), $phrase, $site)
                /* translators: 1: e.g. “96 submissions”, 2: the change, e.g. “+18%”, 3: the site's name. */
                : sprintf(__('%1$s last week (%2$s) · %3$s', 'wconvert'), $phrase, self::signed($change) . '%', $site);
        }

        if ($test) {
            /* translators: %s: the email's normal subject line. */
            $subject = sprintf(__('Test: %s', 'wconvert'), $subject);
        }

        $range = self::range($report);
        $eyebrow = $firstWeek
            /* translators: %s: a date range, e.g. “26 Oct – 1 Nov”. */
            ? sprintf(__('Your first week · %s', 'wconvert'), $range)
            /* translators: %s: a date range, e.g. “26 Oct – 1 Nov”. */
            : sprintf(__('Weekly summary · %s', 'wconvert'), $range);

        // The email's own seven complete days, by date: Analytics' "Last 7 days"
        // now includes today, and would not show the numbers above (ADR 0177).
        $actions = [['label' => __('Open WConvert', 'wconvert'), 'url' => $adminUrl . self::analyticsRoute($report)]];

        if ($group === 'leads') {
            $actions[] = ['label' => __('View leads', 'wconvert'), 'url' => $adminUrl . '#leads'];
        }

        return [
            'subject' => $subject,
            'preheader' => implode(', ', array_map(static fn (array $tile): string => $tile['label'] . ': ' . $tile['value'], $tiles)) . '.',
            'eyebrow' => $eyebrow,
            'headline' => $headline,
            'lede' => $lede,
            'tiles' => $tiles,
            'best' => $group === null || count($published) < 2 ? null : self::best($report, $group),
            'insight' => $firstWeek ? null : self::insight($report),
            'actions' => $actions,
            'site' => $site,
            'footer' => [
                'note' => __('Counts are activity, not unique people. Dates are in your site’s time zone.', 'wconvert'),
                /* translators: %s: the site's name. */
                'reason' => sprintf(__('You get this because weekly summaries are on for %s.', 'wconvert'), $site),
                'link' => __('Turn off weekly summaries', 'wconvert'),
                'url' => $adminUrl . '#settings?group=reports',
            ],
        ];
    }

    /**
     * The result the email leads with: submissions when any campaign collects
     * them, else whichever result group has the most.
     *
     * @param array<string, mixed> $report
     */
    private static function leadingGroup(array $report): ?string
    {
        $held = [];

        foreach ($report['impact'] ?? [] as $group) {
            if (in_array($group['id'] ?? null, self::GROUPS, true) && ($group['goals'] ?? []) !== []) {
                $held[$group['id']] = (int) ($group['count'] ?? 0);
            }
        }

        if ($held === []) {
            return null;
        }

        if (isset($held['leads'])) {
            return 'leads';
        }

        arsort($held);

        return (string) array_key_first($held);
    }

    /**
     * One of Dashboard's impact groups (`leads`, `offers`, …, `impressions`).
     *
     * @param array<string, mixed> $report
     * @return array<string, mixed>
     */
    private static function impact(array $report, string $group): array
    {
        foreach ($report['impact'] ?? [] as $entry) {
            if (is_array($entry) && ($entry['id'] ?? null) === $group) {
                return $entry;
            }
        }

        return [];
    }

    /** @param array<string, mixed> $report */
    private static function count(array $report, string $group): int
    {
        return (int) (self::impact($report, $group)['count'] ?? 0);
    }

    /** @param array<string, mixed> $report */
    private static function label(array $report, string $group, string $fallback): string
    {
        $label = self::impact($report, $group)['label'] ?? null;

        return is_string($label) ? $label : $fallback;
    }

    /**
     * Times shown, for the campaigns whose Goal lands in this result group:
     * the denominator the Analytics screen uses for the same rate.
     *
     * @param array<string, mixed> $report
     */
    private static function groupImpressions(array $report, string $group): int
    {
        $goals = self::impact($report, $group)['goals'] ?? [];
        $shown = 0;

        foreach ($report['goals'] ?? [] as $card) {
            if (in_array($card['goal'] ?? null, $goals, true)) {
                $shown += (int) ($card['impressions'] ?? 0);
            }
        }

        return $shown;
    }

    /**
     * Names of the campaigns live now, once each.
     *
     * @param array<string, mixed> $report
     * @return list<string>
     */
    private static function published(array $report): array
    {
        $names = [];

        foreach ($report['goals'] ?? [] as $card) {
            foreach ($card['optins'] ?? [] as $row) {
                if (($row['status'] ?? null) === 'published' && ($row['parent_id'] ?? null) === null) {
                    $names[(string) $row['id']] = (string) $row['name'];
                }
            }
        }

        return array_values($names);
    }

    /**
     * @param array<string, mixed> $report
     * @return ?array{eyebrow: string, title: string, body: string}
     */
    private static function best(array $report, string $group): ?array
    {
        $goals = self::impact($report, $group)['goals'] ?? [];
        $best = null;

        foreach ($report['goals'] ?? [] as $card) {
            if (!in_array($card['goal'] ?? null, $goals, true)) {
                continue;
            }

            foreach ($card['optins'] ?? [] as $row) {
                if (($row['status'] ?? null) !== 'published') {
                    continue;
                }

                if ($best === null || (int) $row['conversions'] > (int) $best['conversions']) {
                    $best = $row;
                }
            }
        }

        if ($best === null || (int) $best['conversions'] === 0) {
            return null;
        }

        $shown = (int) $best['impressions'];

        return [
            'eyebrow' => __('Best campaign', 'wconvert'),
            'title' => (string) $best['name'],
            'body' => sprintf(
                /* translators: 1: e.g. “61 submissions”, 2: times shown, 3: a rate, e.g. “2.4%”. */
                _n('%1$s from %2$s time shown (%3$s)', '%1$s from %2$s times shown (%3$s)', $shown, 'wconvert'),
                self::resultsPhrase($group, (int) $best['conversions']),
                number_format_i18n($shown),
                $shown === 0 ? '–' : self::rate((int) $best['conversions'] / $shown)
            ),
        ];
    }

    /**
     * The first of {@see \WConvert\Stats\Insights}' cards, in its own words.
     *
     * @param array<string, mixed> $report
     * @return ?array{eyebrow: string, title: string, body: string}
     */
    private static function insight(array $report): ?array
    {
        $card = $report['insights'][0] ?? null;

        if (!is_array($card) || !is_string($card['name'] ?? null)) {
            return null;
        }

        return [
            'eyebrow' => __('Worth a look', 'wconvert'),
            'title' => $card['name'],
            'body' => trim((string) ($card['title'] ?? '') . '. ' . (string) ($card['note'] ?? '')),
        ];
    }

    /** @return array{label: string, value: string, change: string, tone: string} */
    private static function tile(string $label, string $value, bool $firstWeek, int $now, ?int $before): array
    {
        if ($firstWeek) {
            return ['label' => $label, 'value' => $value, 'change' => __('First week', 'wconvert'), 'tone' => 'flat'];
        }

        $percent = self::percent($now, $before);

        return [
            'label' => $label,
            'value' => $value,
            'change' => $before === null ? '' : ($percent === null
                ? __('None the week before', 'wconvert')
                /* translators: %s: a signed percentage change, e.g. “+12%”. */
                : sprintf(__('%s vs last week', 'wconvert'), self::signed($percent) . '%')),
            'tone' => $percent === null ? 'flat' : self::tone($percent),
        ];
    }

    private static function resultsPhrase(string $group, int $count): string
    {
        $number = number_format_i18n($count);

        return match ($group) {
            /* translators: %s: a number. */
            'offers' => sprintf(_n('%s offer link click', '%s offer link clicks', $count, 'wconvert'), $number),
            /* translators: %s: a number. */
            'carts' => sprintf(_n('%s cart return click', '%s cart return clicks', $count, 'wconvert'), $number),
            /* translators: %s: a number. */
            'additions' => sprintf(_n('%s basket addition', '%s basket additions', $count, 'wconvert'), $number),
            /* translators: %s: a number. */
            default => sprintf(_n('%s submission', '%s submissions', $count, 'wconvert'), $number),
        };
    }

    private static function rateLabel(string $group): string
    {
        return match ($group) {
            'offers', 'carts' => __('Click rate', 'wconvert'),
            'additions' => __('Addition rate', 'wconvert'),
            default => __('Submission rate', 'wconvert'),
        };
    }

    /** A whole-number percentage change, or null when there is nothing to compare with. */
    private static function percent(int $now, ?int $before): ?int
    {
        if ($before === null || $before === 0) {
            return null;
        }

        return (int) round(($now - $before) / $before * 100);
    }

    private static function lede(?int $change, string $campaigns): string
    {
        if ($change === null) {
            /* translators: %s: e.g. “3 published campaigns”. */
            return sprintf(__('Across %s. Nothing to compare with the week before.', 'wconvert'), $campaigns);
        }

        if ($change > 0) {
            /* translators: 1: a percentage, 2: e.g. “3 published campaigns”. */
            return sprintf(__('%1$s%% more than the week before, across %2$s.', 'wconvert'), number_format_i18n($change), $campaigns);
        }

        if ($change < 0) {
            /* translators: 1: a percentage, 2: e.g. “3 published campaigns”. */
            return sprintf(__('%1$s%% fewer than the week before, across %2$s.', 'wconvert'), number_format_i18n(abs($change)), $campaigns);
        }

        /* translators: %s: e.g. “3 published campaigns”. */
        return sprintf(__('The same as the week before, across %s.', 'wconvert'), $campaigns);
    }

    private static function pointsChange(?float $rate, ?float $before): string
    {
        if ($rate === null || $before === null) {
            return __('None the week before', 'wconvert');
        }

        $points = round(($rate - $before) * 100, 1);

        /* translators: %s: a signed change in percentage points, e.g. “+0.1”. */
        return sprintf(__('%s pts vs last week', 'wconvert'), self::sign($points) . number_format_i18n(abs($points), 1));
    }

    private static function rate(float $rate): string
    {
        return number_format_i18n($rate * 100, 1) . '%';
    }

    private static function signed(int $percent): string
    {
        return self::sign($percent) . number_format_i18n(abs($percent));
    }

    /** A typographic minus, not a hyphen, so “−5%” reads as a number. */
    private static function sign(float $value): string
    {
        return $value > 0 ? '+' : ($value < 0 ? '−' : '');
    }

    private static function tone(float $change): string
    {
        return $change > 0 ? 'up' : ($change < 0 ? 'down' : 'flat');
    }

    /**
     * Analytics at the report's own dates, or its 7 days when they are unreadable.
     *
     * @param array<string, mixed> $report
     */
    private static function analyticsRoute(array $report): string
    {
        $from = (string) ($report['from'] ?? '');
        $to = (string) ($report['to'] ?? '');
        $day = '/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/D';

        return preg_match($day, $from) && preg_match($day, $to)
            ? '#analytics?from=' . $from . '&to=' . $to
            : '#analytics?days=7';
    }

    /** @param array<string, mixed> $report */
    private static function range(array $report): string
    {
        $from = self::noon((string) ($report['from'] ?? ''));
        $to = self::noon((string) ($report['to'] ?? ''));

        if ($from === null || $to === null) {
            return '';
        }

        return wp_date('j M', $from) . ' – ' . wp_date('j M', $to);
    }

    private static function weekday(string $day): string
    {
        $noon = self::noon($day);

        return $noon === null ? $day : wp_date('l', $noon);
    }

    /** Noon on a site day, so a timezone offset can never move it to a neighbour. */
    private static function noon(string $day): ?int
    {
        $moment = \DateTimeImmutable::createFromFormat('!Y-m-d H:i', $day . ' 12:00', wp_timezone());

        return $moment === false ? null : $moment->getTimestamp();
    }
}

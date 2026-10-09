<?php
namespace WConvert\Stats;

defined('ABSPATH') || exit;

/** Descriptive rules over accepted report facts. No visitor identity or causal inference. */
final class Insights
{
    /** @param array<string, mixed> $report
     * @return list<array<string, mixed>> */
    public static function forReport(array $report): array
    {
        if (empty($report['complete_days']) || $report['days'] < 1) return [];
        $previous = [];
        foreach ($report['previous']['goals'] ?? [] as $goal) {
            foreach ($goal['optins'] as $row) $previous[$row['id']] = $row;
        }
        $cards = [];
        foreach ($report['goals'] as $goal) {
            foreach ($goal['optins'] as $row) {
                if ($row['status'] !== 'published') continue;
                $prior = $previous[$row['id']] ?? null;
                $current = self::facts($row);
                $before = $prior === null ? null : self::facts($prior);
                $rule = null;
                $title = '';
                $note = '';
                // The latest publication must precede the whole window. A recent
                // publish (including a republish) cannot prove historical eligibility.
                $publishedAt = $row['published_at'] ?? null;
                if ($current['appearances'] === 0 && $report['days'] >= 7
                    && is_string($publishedAt) && $publishedAt < $report['from'] . ' 00:00:00') {
                    $rule = 'no_appearances';
                    $title = __('No appearances recorded', 'wconvert');
                    $note = __('Review when and where this campaign can appear.', 'wconvert');
                } elseif ($before !== null && $report['days'] >= 7 && ($report['previous']['days'] ?? 0) === $report['days']
                    && min($current['appearances'], $before['appearances']) >= 200
                    && $current['results'] + $before['results'] >= 20
                    && abs($before['results'] - $current['results']) >= 10 && $before['rate'] > 0) {
                    $relative = ($current['rate'] - $before['rate']) / $before['rate'];
                    if ($current['results'] < $before['results'] && $current['appearances'] < $before['appearances'] && abs($current['rate'] - $before['rate']) <= 0.002 && abs($relative) <= 0.1) {
                        $rule = 'lower_exposure';
                        $title = __('Shown less often', 'wconvert');
                        $note = __('Fewer results, with a similar rate. Check display rules and site traffic.', 'wconvert');
                    } elseif ($relative <= -0.2) {
                        $rule = 'lower_rate';
                        /* translators: %s: the goal's rate label, e.g. “Email submission rate”. */
                        $title = sprintf(__('%s fell', 'wconvert'), $goal['rate_label']);
                        $note = __('Review the campaign, then test one change.', 'wconvert');
                    }
                }
                if ($rule === null) continue;
                $facts = ['current' => $current, 'previous' => $before];
                $periods = ['from' => $report['from'], 'to' => $report['to'], 'previous_from' => $report['previous']['from'] ?? null, 'previous_to' => $report['previous']['to'] ?? null];
                $cards[] = ['rule_id' => $rule, 'rule_version' => 1, 'optin_id' => $row['id'], 'goal' => $goal['goal'],
                    'name' => $row['name'], 'result_label' => $goal['result_label'], 'rate_label' => $goal['rate_label'], 'title' => $title, 'note' => $note,
                    'evidence_type' => 'observed', 'facts' => $facts, 'periods' => $periods,
                    'fingerprint' => hash('sha256', (string) wp_json_encode([$rule, $row['id'], $facts, $periods])),
                    'limitation' => __('The cause is unknown. Current settings do not prove what happened during this period. Counts are activity, not unique people.', 'wconvert'),
                    'action' => $rule === 'lower_rate' ? 'edit' : 'display',
                    'priority' => $rule === 'no_appearances' ? 0 : 1,
                    'difference' => ($before['results'] ?? 0) - $current['results']];
            }
        }
        usort($cards, static fn (array $a, array $b): int => [$a['priority'], -abs($a['difference']), $a['optin_id']] <=> [$b['priority'], -abs($b['difference']), $b['optin_id']]);
        // Scope and the three-card display limit belong to the consumer, not the site-wide read.
        return $cards;
    }

    /** @param array<string, mixed> $row
     * @return array{appearances: int, results: int, rate: ?float} */
    private static function facts(array $row): array
    {
        $shown = (int) $row['impressions'];
        $results = (int) $row['conversions'];
        return ['appearances' => $shown, 'results' => $results, 'rate' => $shown > 0 ? $results / $shown : null];
    }
}

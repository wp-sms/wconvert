<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Discovery\OccasionStore;
use WConvert\Rest\ReportWindow;
use WConvert\Stats\Dashboard;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatRange;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * How campaigns are doing, as counts: shown, converted, dismissed.
 *
 * Read off {@see Dashboard}, so the numbers are the Reports screen's. An
 * occasion's total adds clicks only from campaigns that convert on a click,
 * as the occasion page does: a signup and a click are different acts and
 * their sum is a number nobody can read (ADR 0020). A/B arms count toward
 * their campaign. Never a visitor, never a [[Lead]].
 */
final class GetStats implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly Dashboard $dashboard,
        private readonly OccasionStore $occasions,
        private readonly CampaignReader $reader,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/get-stats';
    }

    public function definition(): array
    {
        return [
            'label' => __('Get campaign stats', 'wconvert'),
            'description' => __('Reports how WConvert campaigns are doing over a window of days: shown (times a campaign appeared), conversions (signups, or clicks for click goals), conversion_rate (conversions out of shown, 0–1) and dismissed (times a visitor closed it). Give campaign_id for one campaign, occasion_id for every campaign in an occasion (with a total), or neither for all. The window is the last 7, 30 or 90 days, or from/to as YYYY-MM-DD days in the site timezone. Only counts: no visitor or contact data. Example: {"occasion_id": "black-friday-2026", "days": 7}.', 'wconvert'),
            'input_schema' => Reply::input([
                'campaign_id' => ['type' => 'string', 'description' => 'One campaign.'],
                'occasion_id' => ['type' => 'string', 'description' => 'Every campaign in one occasion.'],
                'days' => ['type' => 'integer', 'enum' => [7, 30, 90], 'default' => 30, 'description' => 'The last 7, 30 or 90 days, today included.'],
                'from' => ['type' => 'string', 'pattern' => '^\d{4}-\d{2}-\d{2}$', 'description' => 'First day, YYYY-MM-DD. Use with to.'],
                'to' => ['type' => 'string', 'pattern' => '^\d{4}-\d{2}-\d{2}$', 'description' => 'Last day, YYYY-MM-DD. Use with from.'],
            ]),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        if (isset($input['from']) !== isset($input['to'])) {
            return Reply::refused(__('Give both from and to, or neither and use days.', 'wconvert'));
        }
        try {
            $range = isset($input['from'])
                ? StatRange::between((string) $input['from'], (string) $input['to'], StatDay::today())
                : StatRange::lastDays((int) ($input['days'] ?? 30), StatDay::today());
        } catch (\InvalidArgumentException $refused) {
            return ReportWindow::error($refused);
        }

        $ids = null;
        if (isset($input['campaign_id'])) {
            if ($this->reader->raw((string) $input['campaign_id']) === null) {
                return Reply::notFound(__('No campaign has that campaign_id. List them with wconvert/find-campaigns.', 'wconvert'));
            }
            $ids = [(string) $input['campaign_id']];
        } elseif (isset($input['occasion_id'])) {
            if ($this->occasions->find((string) $input['occasion_id']) === null) {
                return Reply::notFound(__('No occasion has that occasion_id. List them with wconvert/list-occasions.', 'wconvert'));
            }
            $ids = array_column(array_filter($this->reader->all(), static fn (array $row): bool => ($row['occasion']['occasion_id'] ?? null) === $input['occasion_id']), 'campaign_id');
        }

        return ['from' => $range->from, 'to' => $range->to, 'timezone' => Reply::timezone()]
            + self::counted($this->dashboard->read($range), $ids)
            + ['note' => __('Clicks in the total come only from campaigns that convert on a click; signups stay in each campaign\'s own conversions.', 'wconvert')];
    }

    /**
     * Each campaign's counts out of a Reports payload, its arms added in, and
     * a total whose clicks come only from click goals.
     *
     * @param array<string, mixed> $report {@see Dashboard::read()}.
     * @param list<string>|null $ids The campaigns asked about, or null for all.
     * @return array{campaigns: list<array<string, mixed>>, total: array<string, int|float|null>}
     */
    public static function counted(array $report, ?array $ids): array
    {
        $campaigns = [];
        foreach ($report['goals'] as $card) {
            foreach ($card['optins'] as $row) {
                $id = (string) ($row['parent_id'] ?? $row['id']);
                if ($ids !== null && !in_array($id, $ids, true)) continue;
                $campaign = $campaigns[$id] ?? ['campaign_id' => $id, 'name' => null, 'goal' => $card['goal'], 'converts_on' => $card['action'], 'shown' => 0, 'conversions' => 0, 'dismissed' => 0];
                if ($row['parent_id'] === null) $campaign['name'] = (string) $row['name'];
                $campaign['shown'] += (int) $row['impressions'];
                $campaign['conversions'] += (int) $row['conversions'];
                $campaign['dismissed'] += (int) $row['dismissals'];
                $campaigns[$id] = $campaign;
            }
        }
        $campaigns = array_values(array_map(static fn (array $c): array => $c + ['conversion_rate' => $c['shown'] === 0 ? null : round($c['conversions'] / $c['shown'], 4)], $campaigns));

        $clicking = array_filter($campaigns, static fn (array $c): bool => $c['converts_on'] === 'click');
        $clickShown = array_sum(array_column($clicking, 'shown'));
        $clicks = array_sum(array_column($clicking, 'conversions'));
        return [
            'campaigns' => $campaigns,
            'total' => [
                'shown' => array_sum(array_column($campaigns, 'shown')),
                'dismissed' => array_sum(array_column($campaigns, 'dismissed')),
                'clicks' => $clicking === [] ? null : $clicks,
                'click_rate' => $clicking === [] || $clickShown === 0 ? null : round($clicks / $clickShown, 4),
            ],
        ];
    }
}

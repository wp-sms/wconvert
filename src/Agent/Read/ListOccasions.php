<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Discovery\OccasionStore;
use WConvert\Optin\CampaignState;
use WConvert\Optin\OccasionSchedule;

defined('ABSPATH') || exit;

/** Every occasion — Black Friday, a launch — with its dates and how many campaigns it holds. */
final class ListOccasions implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly OccasionStore $occasions,
        private readonly CampaignReader $reader,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/list-occasions';
    }

    public function definition(): array
    {
        return [
            'label' => __('List occasions', 'wconvert'),
            'description' => __('Lists WConvert occasions. An occasion is a named date range, such as Black Friday 20 Nov – 1 Dec, that groups the campaigns made for it; it never publishes or schedules anything by itself. Each comes with its first and last day (inclusive), whether it has started, is running or has ended, and how many campaigns it holds. Use an occasion_id with wconvert/get-occasion, wconvert/find-campaigns or wconvert/create-campaign. Takes no input: {}.', 'wconvert'),
            'input_schema' => Reply::input([]),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array
    {
        $counts = [];
        foreach ($this->reader->all() as $row) {
            $id = $row['occasion']['occasion_id'] ?? null;
            if (is_string($id)) $counts[$id] = ($counts[$id] ?? 0) + 1;
        }
        $items = array_map(static fn (array $item): array => self::describe($item) + ['campaign_count' => $counts[$item['id']] ?? 0], $this->occasions->read()['items']);
        return ['occasions' => $items, 'timezone' => Reply::timezone(), 'next' => $items === []
            ? __('No occasion yet. Make one with wconvert/save-occasion.', 'wconvert')
            : __('See one occasion and its campaigns with wconvert/get-occasion.', 'wconvert')];
    }

    /**
     * @param array<string, string> $item
     * @return array<string, mixed>
     */
    public static function describe(array $item): array
    {
        return [
            'occasion_id' => $item['id'],
            'name' => $item['name'],
            'first_day' => $item['start'],
            'last_day' => $item['end'],
            'phase' => CampaignState::phase(OccasionSchedule::of($item['start'], $item['end']), wp_timezone()),
        ];
    }
}

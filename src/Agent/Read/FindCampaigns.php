<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Optin\DisplayType;

defined('ABSPATH') || exit;

/** The campaigns list, filtered the way the admin's list filters. */
final class FindCampaigns implements Ability
{
    use ManagersOnly;

    public function __construct(private readonly CampaignReader $reader)
    {
    }

    public function name(): string
    {
        return 'wconvert/find-campaigns';
    }

    public function definition(): array
    {
        return [
            'label' => __('Find campaigns', 'wconvert'),
            'description' => __('Lists WConvert campaigns: the popups, floating bars, slide-ins, full-screen takeovers and inline forms on this site. Each has a name, a goal, a display type, a status (draft, published, or suspended when the site cannot show it) and a schedule. A/B test variants are nested under their campaign. Use this first to find a campaign_id, then wconvert/get-campaign for its words and settings. Filter by occasion_id to see one occasion such as Black Friday (find occasions with wconvert/list-occasions). Example: {"occasion_id": "black-friday-2026", "status": "draft"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'occasion_id' => ['type' => 'string', 'description' => 'Only campaigns in this occasion.'],
                'status' => ['type' => 'string', 'enum' => ['draft', 'published', 'suspended'], 'description' => 'Only campaigns in this state.'],
                'display_type' => ['type' => 'string', 'enum' => array_map(static fn (DisplayType $type): string => $type->value, DisplayType::cases()), 'description' => 'Only this kind of campaign.'],
                'search' => ['type' => 'string', 'description' => 'Words in the campaign name.'],
            ] + Reply::pageSchema()),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array
    {
        $search = mb_strtolower(trim((string) ($input['search'] ?? '')));
        $rows = array_values(array_filter($this->reader->all(), static fn (array $row): bool =>
            (!isset($input['occasion_id']) || ($row['occasion']['occasion_id'] ?? null) === $input['occasion_id'])
            && (!isset($input['status']) || $row['status'] === $input['status'])
            && (!isset($input['display_type']) || $row['display_type'] === $input['display_type'])
            && ($search === '' || str_contains(mb_strtolower($row['name']), $search))));
        return Reply::paged($rows, $input) + [
            'next' => $rows === []
                ? __('No campaign matches. Make one with wconvert/create-campaign, starting from wconvert/find-designs or wconvert/list-starters.', 'wconvert')
                : __('Read one with wconvert/get-campaign, or check whether it can go live with wconvert/review-campaign.', 'wconvert'),
        ];
    }
}

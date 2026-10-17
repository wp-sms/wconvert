<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WP_Error;

defined('ABSPATH') || exit;

/** One campaign, as an agent needs it to change it. Never its design's tree. */
final class GetCampaign implements Ability
{
    use ManagersOnly;

    public function __construct(private readonly CampaignReader $reader)
    {
    }

    public function name(): string
    {
        return 'wconvert/get-campaign';
    }

    public function definition(): array
    {
        return [
            'label' => __('Get a campaign', 'wconvert'),
            'description' => __('Reads one WConvert campaign: its words by slot role (headline, body, cta_label…), which design it uses, its display type, the pages it shows on, how often a visitor sees it, its schedule with the site timezone, its status and occasion, a preview link, and its revision. Pass the revision to wconvert/update-campaign as expected_revision so a change someone made meanwhile is not overwritten. When a published campaign has unpublished changes, "live" shows what visitors see now. Example: {"campaign_id": "01JD5Z7Q8X3M4N5P6R7S8T9V0W"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'campaign_id' => ['type' => 'string', 'description' => 'The campaign, from wconvert/find-campaigns.'],
            ], ['campaign_id']),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        $optin = $this->reader->raw((string) $input['campaign_id']);
        if ($optin === null) {
            return Reply::notFound(__('No campaign has that campaign_id. List them with wconvert/find-campaigns.', 'wconvert'));
        }
        return $this->reader->describe($optin) + [
            'next' => __('Change it with wconvert/update-campaign (pass revision as expected_revision). Check it with wconvert/review-campaign before a person publishes it.', 'wconvert'),
        ];
    }
}

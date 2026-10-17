<?php

namespace WConvert\Agent\Draft;

use WConvert\Agent\Ability;
use WConvert\Agent\AgentCampaignInput;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Optin\OptinState;
use WConvert\Rest\InternalRest;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * Change a campaign's draft, field by field.
 *
 * Only the fields given change; the rest of the draft is what was read. A
 * published campaign keeps showing its live version until someone publishes
 * again — the write is `PATCH /optins/{id}`, which saves the draft only.
 */
final class UpdateCampaign implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly AgentCampaignInput $campaigns,
        private readonly CampaignReader $reader,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/update-campaign';
    }

    public function definition(): array
    {
        return [
            'label' => __('Update a campaign draft', 'wconvert'),
            'description' => __('Changes a WConvert campaign\'s draft: only the fields you give change. Read it first with wconvert/get-campaign and pass its revision as expected_revision; if someone changed it since, this is refused and you read it again. On a published campaign, visitors keep seeing the live version until it is published again. Words go by slot role in copy; dates are "YYYY-MM-DD HH:MM" in the site timezone, "" to clear. Example: {"campaign_id": "01JD5Z7Q8X3M4N5P6R7S8T9V0W", "expected_revision": "3f9c0a1b2c3d4e5f", "copy": {"headline": "Last day: 30% off"}}.', 'wconvert'),
            'input_schema' => Reply::input([
                'campaign_id' => ['type' => 'string', 'description' => 'The campaign, from wconvert/find-campaigns.'],
                'expected_revision' => ['type' => 'string', 'description' => 'The revision wconvert/get-campaign returned.'],
                'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 190, 'description' => 'A new name.'],
            ] + AgentCampaignInput::schema(), ['campaign_id', 'expected_revision']),
            'annotations' => ['readonly' => false, 'destructive' => false, 'idempotent' => false],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        $id = (string) $input['campaign_id'];
        $raw = $this->reader->raw($id);
        if ($raw === null) {
            return Reply::notFound(__('No campaign has that campaign_id. List them with wconvert/find-campaigns.', 'wconvert'));
        }
        $config = $this->campaigns->forUpdate($input, is_array($raw['config'] ?? null) ? $raw['config'] : []);
        if ($config instanceof WP_Error) return $config;

        $body = ['config' => $config, 'expected_revision' => (string) $input['expected_revision']];
        if (isset($input['name'])) $body['name'] = (string) $input['name'];
        $result = InternalRest::run('PATCH', '/optins/' . $id, $body);
        if (InternalRest::failed($result) || !is_array($result['data'])) {
            return Reply::fromRest($result, __('This campaign could not be saved.', 'wconvert'));
        }
        $campaign = $this->reader->describe($result['data']);
        $published = OptinState::isPublished($campaign['status']);
        return [
            'campaign_id' => $id,
            'name' => $campaign['name'],
            'status' => $campaign['status'],
            'copy' => $campaign['copy'],
            'empty_roles' => $campaign['empty_roles'],
            'schedule' => $campaign['schedule'],
            'pages' => $campaign['pages'],
            'occasion' => $campaign['occasion'],
            'revision' => $campaign['revision'],
            'has_unpublished_changes' => $campaign['has_unpublished_changes'],
            'preview_url' => $campaign['preview_url'],
            'next' => $published
                ? __('Saved to the draft. The published version is unchanged until it is published again; preview_url shows the draft.', 'wconvert')
                : __('Saved. Check it with wconvert/review-campaign.', 'wconvert'),
        ];
    }
}

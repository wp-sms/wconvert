<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Optin\OptinRepository;
use WConvert\Optin\PublishReadiness;
use WP_Error;

defined('ABSPATH') || exit;

/** Whether a campaign could go live now, and what stops it — without publishing. */
final class ReviewCampaign implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly OptinRepository $optins,
        private readonly PublishReadiness $readiness,
        private readonly CampaignReader $reader,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/review-campaign';
    }

    public function definition(): array
    {
        return [
            'label' => __('Review a campaign', 'wconvert'),
            'description' => __('Checks one WConvert campaign the way Publish does, without publishing it. issues lists every reason Publish would refuse it now, each with what to do; an empty list means it is ready. Also gives the preview link (a site administrator sees the draft on the site there), the slot roles that still have no words, and where today falls in its schedule. Use it after wconvert/create-campaign or wconvert/update-campaign; then a person publishes it, or wconvert/publish does when the site allows agents to publish. Example: {"campaign_id": "01JD5Z7Q8X3M4N5P6R7S8T9V0W"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'campaign_id' => ['type' => 'string', 'description' => 'The campaign, from wconvert/find-campaigns.'],
            ], ['campaign_id']),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        $id = (string) $input['campaign_id'];
        $raw = $this->reader->raw($id);
        $optin = $raw === null ? null : $this->optins->find($id);
        if ($raw === null || $optin === null) {
            return Reply::notFound(__('No campaign has that campaign_id. List them with wconvert/find-campaigns.', 'wconvert'));
        }
        $described = $this->reader->describe($raw);
        $issues = array_map(static fn (array $issue): array => ['code' => $issue['code'], 'message' => $issue['message']], $this->readiness->issues($optin));
        return [
            'campaign_id' => $id,
            'name' => $described['name'],
            'status' => $described['status'],
            'ready_to_publish' => $issues === [],
            'issues' => $issues,
            'empty_roles' => $described['empty_roles'],
            'schedule' => $described['schedule'],
            'preview_url' => $described['preview_url'],
            'next' => $issues === []
                ? __('Ready. A person can publish it in WConvert → Campaigns, or wconvert/publish can if the site lets agents publish.', 'wconvert')
                : __('Fix each issue (many need WConvert → Campaigns → Edit), then review again.', 'wconvert'),
        ];
    }
}

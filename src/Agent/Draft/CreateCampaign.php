<?php

namespace WConvert\Agent\Draft;

use WConvert\Agent\Ability;
use WConvert\Agent\AgentCampaignInput;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Goal\Goal;
use WConvert\Optin\DisplayType;
use WConvert\Rest\InternalRest;
use WP_Error;

defined('ABSPATH') || exit;

/** A new draft campaign from a design or a starter, and words by role. Never published. */
final class CreateCampaign implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly AgentCampaignInput $campaigns,
        private readonly CampaignReader $reader,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/create-campaign';
    }

    public function definition(): array
    {
        return [
            'label' => __('Create a draft campaign', 'wconvert'),
            'description' => __('Makes a new WConvert campaign as a DRAFT: nothing shows on the site until it is published. Start from a design_id (wconvert/find-designs) or a starter_id (wconvert/list-starters), give a name and a goal, and give words by slot role in copy. Optional: link (where the button goes), pages (paths it shows on), frequency, starts_at/ends_at in the site timezone, and occasion_id — inside an occasion, a campaign with no dates takes the occasion\'s. The reply gives the campaign_id, which roles are filled and which are still empty, and a preview link. Next: wconvert/review-campaign; then a person publishes. Example: {"name": "Black Friday bar", "goal": "promote_offer", "design_id": "bar-countdown", "copy": {"headline": "30% off everything — ends Monday", "cta_label": "Shop the sale"}, "link": "/black-friday/", "occasion_id": "black-friday-2026"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 190, 'description' => 'What the merchant calls it in WConvert, e.g. "Black Friday bar".'],
                'goal' => ['type' => 'string', 'enum' => array_map(static fn (Goal $goal): string => $goal->value, Goal::cases()), 'description' => 'What it is for. promote_offer sends visitors to an offer; show_message only shows words and counts appearances; grow_email_list collects email addresses.'],
                'design_id' => ['type' => 'string', 'description' => 'A design from wconvert/find-designs.'],
                'starter_id' => ['type' => 'string', 'description' => 'A starter from wconvert/list-starters, instead of design_id.'],
                'display_type' => ['type' => 'string', 'enum' => array_map(static fn (DisplayType $type): string => $type->value, DisplayType::cases()), 'description' => 'Optional; the design decides it. Given, it must match.'],
            ] + AgentCampaignInput::schema(), ['name', 'goal']),
            'annotations' => ['readonly' => false, 'destructive' => false, 'idempotent' => false],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        $draft = $this->campaigns->forCreate($input);
        if ($draft instanceof WP_Error) return $draft;
        $result = InternalRest::run('POST', '/optins', $draft);
        if (InternalRest::failed($result) || !is_array($result['data'])) {
            return Reply::fromRest($result, __('This campaign could not be created.', 'wconvert'));
        }
        $campaign = $this->reader->describe($result['data']);
        return [
            'campaign_id' => $campaign['campaign_id'],
            'name' => $campaign['name'],
            'status' => $campaign['status'],
            'display_type' => $campaign['display_type'],
            'design' => $campaign['design'],
            'filled_roles' => array_keys(array_filter($campaign['copy'], static fn ($words): bool => $words !== '' && $words !== [])),
            'empty_roles' => $campaign['empty_roles'],
            'schedule' => $campaign['schedule'],
            'occasion' => $campaign['occasion'],
            'revision' => $campaign['revision'],
            'preview_url' => $campaign['preview_url'],
            'timezone' => Reply::timezone(),
            'next' => $campaign['display_type'] === 'inline' && $campaign['inline_position'] === null
                ? __('It is a draft. An inline campaign with no inline_position shows only where someone places the WConvert block or the [wconvert_optin] shortcode; set inline_position with wconvert/update-campaign to place it automatically. Check it with wconvert/review-campaign; then a person publishes it.', 'wconvert')
                : __('It is a draft. Check it with wconvert/review-campaign and open preview_url to see it; then a person publishes it in WConvert → Campaigns.', 'wconvert'),
        ];
    }
}

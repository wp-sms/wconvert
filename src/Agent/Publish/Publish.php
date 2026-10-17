<?php

namespace WConvert\Agent\Publish;

use WConvert\Agent\Reply;
use WConvert\Optin\OptinState;

defined('ABSPATH') || exit;

/** Put a campaign's draft live, or an occasion's campaigns — when the site allows agents to. */
final class Publish extends CampaignSwitch
{
    public function name(): string
    {
        return 'wconvert/publish';
    }

    public function definition(): array
    {
        return [
            'label' => __('Publish campaigns', 'wconvert'),
            'description' => __('Publishes a WConvert campaign, or every campaign in an occasion: its draft becomes what visitors see, within its schedule. Works only when a site administrator has turned on "Let AI agents publish" in WConvert → Settings → Connections & destinations; otherwise it is refused and a person publishes. Run wconvert/review-campaign first. Each campaign meets the same checks as Publish in the editor; refused ones are named with the reason, and A/B test variants are skipped. caches_cleared names the page caches emptied. Example: {"occasion_id": "black-friday-2026"}.', 'wconvert'),
            'input_schema' => Reply::input(self::targetSchema()),
            'annotations' => ['readonly' => false, 'destructive' => true, 'idempotent' => true],
        ];
    }

    protected function route(): string
    {
        return 'publish';
    }

    protected function doneKey(): string
    {
        return 'published';
    }

    /** @param array<string, mixed> $row */
    protected function alreadyThere(array $row): ?string
    {
        return OptinState::isPublished($row['status']) && !$row['has_unpublished_changes']
            ? __('Already published, with no unpublished changes.', 'wconvert')
            : null;
    }
}

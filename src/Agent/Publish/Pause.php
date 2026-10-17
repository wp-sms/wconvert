<?php

namespace WConvert\Agent\Publish;

use WConvert\Agent\Reply;

defined('ABSPATH') || exit;

/** Take a campaign off the site, or an occasion's campaigns — when the site allows agents to. */
final class Pause extends CampaignSwitch
{
    public function name(): string
    {
        return 'wconvert/pause';
    }

    public function definition(): array
    {
        return [
            'label' => __('Pause campaigns', 'wconvert'),
            'description' => __('Pauses (unpublishes) a WConvert campaign, or every campaign in an occasion: visitors stop seeing it at once, and its draft and stats are kept, so publishing again brings it back. Use it to end a sale early. Works only when a site administrator has turned on "Let AI agents publish" in WConvert → Settings → Connections & destinations; otherwise it is refused and a person pauses it. A/B test variants are skipped. caches_cleared names the page caches emptied. Example: {"campaign_id": "01JD5Z7Q8X3M4N5P6R7S8T9V0W"}.', 'wconvert'),
            'input_schema' => Reply::input(self::targetSchema()),
            'annotations' => ['readonly' => false, 'destructive' => true, 'idempotent' => true],
        ];
    }

    protected function route(): string
    {
        return 'unpublish';
    }

    protected function doneKey(): string
    {
        return 'paused';
    }

    /** @param array<string, mixed> $row */
    protected function alreadyThere(array $row): ?string
    {
        return in_array($row['status'], ['published', 'suspended'], true) ? null : __('Not published, so nothing to pause.', 'wconvert');
    }
}

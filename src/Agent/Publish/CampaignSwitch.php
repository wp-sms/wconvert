<?php

namespace WConvert\Agent\Publish;

use WConvert\Agent\Ability;
use WConvert\Agent\AgentPublishing;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\Reply;
use WConvert\Discovery\OccasionStore;
use WConvert\Frontend\PageCache;
use WConvert\Rest\InternalRest;
use WConvert\Rest\Routes;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * Publish or pause one campaign, or every campaign of an occasion — only when
 * a site administrator has turned on "Let AI agents publish" (ADR 0154 §7).
 *
 * Each campaign goes through `/optins/{id}/publish` or `/unpublish`, so every
 * refusal Publish makes in the editor is the one the agent meets. An occasion
 * acts on its campaigns and never on their A/B variants, which are named as
 * skipped. The reply names the page caches the change cleared.
 */
abstract class CampaignSwitch implements Ability
{
    public function __construct(
        private readonly AgentPublishing $publishing,
        private readonly OccasionStore $occasions,
        private readonly CampaignReader $reader,
    ) {
    }

    /** `publish` or `unpublish`, the route's last segment. */
    abstract protected function route(): string;

    /**
     * Why a campaign is already where this would put it, or null.
     *
     * @param array<string, mixed> $row
     */
    abstract protected function alreadyThere(array $row): ?string;

    abstract protected function doneKey(): string;

    public function permitted(array $input): bool|WP_Error
    {
        if (!Routes::canManage()) return false;
        if (!$this->publishing->enabled()) {
            return new WP_Error('wconvert_agents_publish_off', __('Publishing by agents is off — a person can publish in WConvert → Campaigns', 'wconvert'), ['status' => 403]);
        }
        return true;
    }

    /** @return array<string, array<string, mixed>> */
    protected static function targetSchema(): array
    {
        return [
            'campaign_id' => ['type' => 'string', 'description' => 'One campaign, from wconvert/find-campaigns.'],
            'occasion_id' => ['type' => 'string', 'description' => 'Every campaign in this occasion, from wconvert/list-occasions.'],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        if (isset($input['campaign_id']) === isset($input['occasion_id'])) {
            return Reply::refused(__('Give either a campaign_id or an occasion_id, not both.', 'wconvert'));
        }
        $done = []; $skipped = []; $failed = []; $suspended = [];
        if (isset($input['campaign_id'])) {
            $raw = $this->reader->raw((string) $input['campaign_id']);
            if ($raw === null) return Reply::notFound(__('No campaign has that campaign_id. List them with wconvert/find-campaigns.', 'wconvert'));
            $described = $this->reader->describe($raw);
            $rows = [['campaign_id' => $described['campaign_id'], 'name' => $described['name'], 'status' => $described['status'], 'has_unpublished_changes' => $described['has_unpublished_changes']]];
        } else {
            $id = (string) $input['occasion_id'];
            if ($this->occasions->find($id) === null) return Reply::notFound(__('No occasion has that occasion_id. List them with wconvert/list-occasions.', 'wconvert'));
            $rows = array_values(array_filter($this->reader->all(), static fn (array $row): bool => ($row['occasion']['occasion_id'] ?? null) === $id));
            foreach ($rows as $row) {
                foreach ($row['ab_test_variants'] ?? [] as $variant) {
                    $skipped[] = ['campaign_id' => $variant['campaign_id'], 'name' => $variant['name'], 'reason' => __('An A/B test variant. A person manages the test in WConvert → Campaigns.', 'wconvert')];
                }
            }
        }

        PageCache::forgetLastPurge();
        foreach ($rows as $row) {
            $named = ['campaign_id' => $row['campaign_id'], 'name' => $row['name']];
            $there = $this->alreadyThere($row);
            if ($there !== null) { $skipped[] = $named + ['reason' => $there]; continue; }
            $result = InternalRest::run('POST', '/optins/' . $row['campaign_id'] . '/' . $this->route());
            if (InternalRest::failed($result)) {
                $failed[] = $named + ['reason' => InternalRest::message($result, __('It was refused.', 'wconvert'))];
                continue;
            }
            $done[] = $named;
            $because = is_array($result['data']) ? ($result['data']['suspended'] ?? null) : null;
            if (is_string($because)) $suspended[] = $named + ['reason' => $because];
        }

        return [
            $this->doneKey() => $done,
            'skipped' => $skipped,
            'failed' => $failed,
            'suspended' => $suspended,
            'caches_cleared' => PageCache::lastPurged(),
            'next' => $failed === []
                ? __('Done. caches_cleared names the page caches that were emptied so visitors see the change.', 'wconvert')
                : __('Some were refused; each reason says what to fix. wconvert/review-campaign lists everything that stops one going live.', 'wconvert'),
        ];
    }
}

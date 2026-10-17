<?php

namespace WConvert\Agent;

use WConvert\Discovery\OccasionStore;
use WConvert\Frontend\DraftPreview;
use WConvert\Optin\CampaignState;
use WConvert\Optin\ConfigRevision;
use WConvert\Optin\Frequency;
use WConvert\Optin\Optin;
use WConvert\Rest\InternalRest;
use WConvert\Rules\RuleLabels;
use WConvert\Template\CampaignBuilder;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * Campaigns and occasions as an agent reads them.
 *
 * ============================================================================
 * READ THROUGH THE ROUTES THE ADMIN READS.
 * ============================================================================
 * The list and one campaign come from `GET /optins` and `GET /optins/{id}`
 * ({@see InternalRest}), so suspension, the A/B arms and the read-time detach
 * of a deleted occasion (ADR 0149 §5) are the admin's answers, not a second
 * reading of the same rows. What this adds is the shape: names beside ids,
 * copy by [[Slot Role]], targeting in words — and never the design's tree.
 */
final class CampaignReader
{
    public function __construct(
        private readonly OccasionStore $occasions,
        private readonly TemplateLibrary $library,
        private readonly TemplateVocabulary $vocabulary,
    ) {
    }

    /**
     * Every campaign on the list, parents first with their A/B arms inside.
     *
     * @return list<array<string, mixed>>
     */
    public function all(): array
    {
        $result = InternalRest::run('GET', '/optins');
        if (InternalRest::failed($result) || !is_array($result['data'])) return [];
        $names = $this->occasionNames();
        return array_values(array_map(fn (array $row): array => $this->row($row, $names), array_filter($result['data'], 'is_array')));
    }

    /**
     * One campaign as the editor reads it, or null.
     *
     * @return array<string, mixed>|null
     */
    public function raw(string $id): ?array
    {
        if (!\WConvert\Support\Ulid::isOne($id)) return null;
        $result = InternalRest::run('GET', '/optins/' . $id);
        return InternalRest::failed($result) || !is_array($result['data']) || ($result['data']['deleted_at'] ?? null) !== null ? null : $result['data'];
    }

    /**
     * One campaign in full, for an agent: never its tree.
     *
     * @param array<string, mixed> $optin What {@see self::raw()} returned.
     * @return array<string, mixed>
     */
    public function describe(array $optin): array
    {
        $config = is_array($optin['config'] ?? null) ? $optin['config'] : [];
        $published = is_array($optin['published_config'] ?? null) ? $optin['published_config'] : null;
        $names = $this->occasionNames();
        $occasion = is_string($config['occasion'] ?? null) ? $config['occasion'] : null;
        $status = CampaignState::status($optin['published_at'] ?? null, $optin['deleted_at'] ?? null, ($optin['suspended'] ?? null) !== null);
        $tree = $config['template']['tree'] ?? null;
        $roles = is_array($tree) ? SlotRoles::declaredIn($tree, $this->vocabulary) : [];
        $copy = is_array($tree) ? SlotRoles::copyFrom($tree, $this->vocabulary) : [];

        $described = [
            'campaign_id' => (string) $optin['id'],
            'name' => (string) $optin['name'],
            'goal' => (string) $optin['goal'],
            'status' => $status,
            'suspended_because' => $optin['suspended'] ?? null,
            'display_type' => (string) ($config['display_type'] ?? 'popup'),
            'design' => $this->design($config),
            'copy' => $copy,
            'empty_roles' => array_values(array_diff($roles, array_keys(array_filter($copy, static fn ($words): bool => $words !== '' && $words !== [] && $words !== null)))),
            'link' => CampaignBuilder::linkIn($config),
            'pages' => self::pages($config['targeting'] ?? []),
            'inline_position' => is_array($config['inline_placement'] ?? null) ? $config['inline_placement'] : null,
            'opens' => self::opens($config['display_rules'] ?? []),
            'frequency' => self::frequency($config['frequency'] ?? []),
            'schedule' => self::schedule($config),
            'occasion' => $occasion === null ? null : ['occasion_id' => $occasion, 'name' => $names[$occasion] ?? $occasion],
            'is_ab_test_variant' => ($optin['parent_id'] ?? null) !== null,
            'has_unpublished_changes' => (bool) ($optin['has_unpublished_changes'] ?? false),
            'revision' => ConfigRevision::of(new Optin((string) $optin['id'], (string) $optin['name'], (string) $optin['goal'], $config)),
            'preview_url' => DraftPreview::url((string) $optin['id']),
        ];
        // What visitors see now, where the draft has moved on from it.
        if ($published !== null && $described['has_unpublished_changes']) {
            $liveTree = $published['template']['tree'] ?? null;
            $described['live'] = [
                'copy' => is_array($liveTree) ? SlotRoles::copyFrom($liveTree, $this->vocabulary) : [],
                'schedule' => self::schedule($published),
            ];
        }
        return $described;
    }

    /** @return array<string, string> Occasion names by id, live occasions only. */
    public function occasionNames(): array
    {
        $names = [];
        foreach ($this->occasions->read()['items'] as $item) {
            if (is_string($item['id'] ?? null)) $names[$item['id']] = (string) ($item['name'] ?? $item['id']);
        }
        return $names;
    }

    /**
     * Where today falls in a campaign's schedule, with both ends.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function schedule(array $config): array
    {
        return [
            'starts_at' => Reply::when($config['starts_at'] ?? null),
            'ends_at' => Reply::when($config['ends_at'] ?? null),
            'phase' => CampaignState::phase($config, wp_timezone()),
        ];
    }

    /**
     * One list row.
     *
     * @param array<string, mixed> $row
     * @param array<string, string> $names
     * @return array<string, mixed>
     */
    private function row(array $row, array $names): array
    {
        $occasion = is_string($row['occasion'] ?? null) ? $row['occasion'] : null;
        $described = [
            'campaign_id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'goal' => (string) $row['goal'],
            'status' => CampaignState::status($row['published_at'] ?? null, $row['deleted_at'] ?? null, ($row['suspended'] ?? null) !== null),
            'suspended_because' => $row['suspended'] ?? null,
            'display_type' => (string) ($row['display_type'] ?? 'popup'),
            'schedule' => self::schedule(['starts_at' => $row['starts_at'] ?? null, 'ends_at' => $row['ends_at'] ?? null]),
            'occasion' => $occasion === null ? null : ['occasion_id' => $occasion, 'name' => $names[$occasion] ?? $occasion],
            'has_unpublished_changes' => (bool) ($row['has_unpublished_changes'] ?? false),
        ];
        if (is_array($row['arms'] ?? null) && $row['arms'] !== []) {
            $described['ab_test_variants'] = array_map(static fn (array $arm): array => [
                'campaign_id' => (string) $arm['id'],
                'name' => (string) $arm['name'],
                'status' => CampaignState::status($arm['published_at'] ?? null, $arm['deleted_at'] ?? null, ($arm['suspended'] ?? null) !== null),
            ], array_values(array_filter($row['arms'], 'is_array')));
        }
        return $described;
    }

    /**
     * The design a campaign uses, by id and name. One from outside the
     * library is `custom`: it can be read, never named.
     *
     * @param array<string, mixed> $config
     * @return array{design_id: string, name: string}|null
     */
    private function design(array $config): ?array
    {
        if (!is_array($config['template'] ?? null)) return null;
        $id = is_string($config['template_id'] ?? null) ? $config['template_id'] : null;
        $entry = $id === null ? null : $this->library->find($id);
        return $entry === null ? ['design_id' => 'custom', 'name' => __('Custom design', 'wconvert')] : ['design_id' => (string) $id, 'name' => (string) $entry['name']];
    }

    /**
     * Which pages a campaign shows on, in the fields an agent writes back:
     * paths and post types, and any other rule in words.
     *
     * @param mixed $targeting
     * @return array{everywhere: bool, show_on: list<string>, show_on_types: list<string>, hide_on: list<string>, other_rules: list<string>}
     */
    public static function pages(mixed $targeting): array
    {
        $targeting = is_array($targeting) ? $targeting : [];
        $selected = ($targeting['mode'] ?? '') === 'selected';
        $pages = ['everywhere' => !$selected, 'show_on' => [], 'show_on_types' => [], 'hide_on' => [], 'other_rules' => []];
        // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude -- a Targeting key, not a get_posts() argument.
        foreach (['include' => $selected ? ($targeting['include'] ?? []) : [], 'exclude' => $targeting['exclude'] ?? []] as $axis => $rules) {
            foreach (is_array($rules) ? $rules : [] as $rule) {
                if (!is_array($rule)) continue;
                $value = (string) ($rule['value'] ?? '');
                $type = $rule['type'] ?? null;
                if ($type === 'url') { $pages[$axis === 'include' ? 'show_on' : 'hide_on'][] = $value; continue; }
                if ($type === 'singular' && $axis === 'include') { $pages['show_on_types'][] = $value; continue; }
                $words = match ($type) {
                    /* translators: %s: a post or page ID. */
                    'post' => sprintf(__('the post or page with ID %s', 'wconvert'), $value),
                    /* translators: %s: a post type, e.g. product. */
                    'singular' => sprintf(__('every single %s', 'wconvert'), $value),
                    /* translators: %s: a post type, e.g. product. */
                    'archive' => sprintf(__('the %s archive', 'wconvert'), $value),
                    /* translators: %s: a category or tag ID. */
                    'term' => sprintf(__('posts in the category or tag with ID %s', 'wconvert'), $value),
                    default => $value,
                };
                /* translators: %s: a page rule in words. */
                $pages['other_rules'][] = $axis === 'include' ? sprintf(__('only on %s', 'wconvert'), $words) : sprintf(__('never on %s', 'wconvert'), $words);
            }
        }
        return $pages;
    }

    /**
     * When a campaign opens, in the rules' own names.
     *
     * @param mixed $plan
     * @return array{right_away: bool, when: list<string>, audience: string}
     */
    private static function opens(mixed $plan): array
    {
        $plan = is_array($plan) ? $plan : [];
        $immediate = ($plan['opening']['mode'] ?? 'immediate') === 'immediate';
        $when = [];
        foreach ($immediate ? [] : ($plan['opening']['rules'] ?? []) as $rule) {
            if (is_array($rule) && is_string($rule['type'] ?? null)) $when[] = RuleLabels::type($rule['type']);
        }
        return [
            'right_away' => $immediate,
            'when' => $when,
            'audience' => ($plan['audience']['mode'] ?? 'everyone') === 'everyone' ? 'everyone' : 'some visitors',
        ];
    }

    /**
     * How often one visitor sees it, in the names `create-campaign` takes.
     *
     * @param mixed $frequency
     * @return array<string, int|bool|null>
     */
    private static function frequency(mixed $frequency): array
    {
        $read = Frequency::fromArray(is_array($frequency) ? $frequency : []);
        return [
            'per_session' => $read->maxPerSession,
            'cooldown_days' => $read->cooldownDays,
            'max_times' => $read->maxImpressions,
            'stop_after_close' => $read->stopAfterDismiss,
            'stop_after_conversion' => $read->stopAfterConversion,
        ];
    }
}

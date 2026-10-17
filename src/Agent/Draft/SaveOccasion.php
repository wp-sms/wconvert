<?php

namespace WConvert\Agent\Draft;

use WConvert\Agent\Ability;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Read\ListOccasions;
use WConvert\Agent\Reply;
use WConvert\Discovery\OccasionStore;
use WConvert\Optin\Schedule;
use WConvert\Rest\InternalRest;
use WP_Error;

defined('ABSPATH') || exit;

/**
 * Add an occasion, or change one, by id — so saying the same thing twice
 * leaves one occasion.
 *
 * Changing an occasion's dates moves no campaign (ADR 0149 §3), unless the
 * agent asks: `move_campaigns` shifts each campaign's draft by the days the
 * start moved, through the same `PATCH /optins/{id}` an edit uses.
 */
final class SaveOccasion implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly OccasionStore $occasions,
        private readonly CampaignReader $reader,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/save-occasion';
    }

    public function definition(): array
    {
        return [
            'label' => __('Save an occasion', 'wconvert'),
            'description' => __('Adds a WConvert occasion, or changes one. An occasion is a named date range (first and last day, inclusive) that groups campaigns; it never publishes anything. Give occasion_id to change that occasion; leave it out to add one (an occasion with the same name and days is returned, not added twice). Changing the days moves no campaign unless move_campaigns is true: then each of its campaigns\' draft dates move by as many days as the start moved, and the reply names them. Example: {"occasion_id": "black-friday-2026", "name": "Black Friday 2026", "start": "2026-11-27", "end": "2026-12-08", "move_campaigns": true}.', 'wconvert'),
            'input_schema' => Reply::input([
                'occasion_id' => ['type' => 'string', 'pattern' => '^[a-z0-9-]{1,64}$', 'description' => 'The occasion to change, from wconvert/list-occasions.'],
                'name' => ['type' => 'string', 'minLength' => 1, 'maxLength' => 120, 'description' => 'e.g. "Black Friday 2026".'],
                'start' => ['type' => 'string', 'pattern' => '^\d{4}-\d{2}-\d{2}$', 'description' => 'First day, YYYY-MM-DD.'],
                'end' => ['type' => 'string', 'pattern' => '^\d{4}-\d{2}-\d{2}$', 'description' => 'Last day, YYYY-MM-DD (included).'],
                'move_campaigns' => ['type' => 'boolean', 'default' => false, 'description' => 'Move its campaigns\' draft dates with the start.'],
            ], ['name', 'start', 'end']),
            'annotations' => ['readonly' => false, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        $occasion = ['name' => trim((string) $input['name']), 'start' => (string) $input['start'], 'end' => (string) $input['end']];
        $id = isset($input['occasion_id']) ? (string) $input['occasion_id'] : null;
        $before = $id === null ? null : $this->occasions->find($id);

        if ($before === null && $id !== null && in_array($id, $this->occasions->read()['retired'], true)) {
            return Reply::refused(__('That occasion was deleted, and its id is not used again. Leave occasion_id out to add it as a new occasion.', 'wconvert'));
        }
        if ($id === null) {
            foreach ($this->occasions->read()['items'] as $item) {
                if ($item['name'] === $occasion['name'] && $item['start'] === $occasion['start'] && $item['end'] === $occasion['end']) {
                    return ['occasion' => ListOccasions::describe($item), 'added' => false, 'moved' => [], 'failed' => [], 'next' => __('That occasion already exists, unchanged.', 'wconvert')];
                }
            }
        }

        if ($before === null) {
            $saved = $this->occasions->add(['id' => $id ?? self::idFor($occasion['name'], $occasion['start'])] + $occasion);
        } else {
            $saved = $this->occasions->write(static fn (array $items): array => array_map(
                static fn (array $item): array => $item['id'] === $id ? ['id' => $id] + $occasion : $item,
                $items
            ));
            $saved = $saved instanceof WP_Error ? $saved : ['id' => (string) $id] + $occasion;
        }
        if ($saved instanceof WP_Error) return $saved;

        $moved = []; $failed = [];
        if ($before !== null && ($input['move_campaigns'] ?? false) === true && $before['start'] !== $occasion['start']) {
            $days = (int) (new \DateTimeImmutable($before['start']))->diff(new \DateTimeImmutable($occasion['start']))->format('%r%a');
            foreach ($this->reader->all() as $row) {
                if (($row['occasion']['occasion_id'] ?? null) !== $id) continue;
                $result = $this->move($row['campaign_id'], $days);
                if ($result === null) $moved[] = ['campaign_id' => $row['campaign_id'], 'name' => $row['name']];
                else $failed[] = ['campaign_id' => $row['campaign_id'], 'name' => $row['name'], 'reason' => $result];
            }
        }

        return [
            'occasion' => ListOccasions::describe($saved),
            'added' => $before === null,
            'moved' => $moved,
            'failed' => $failed,
            'next' => $before === null
                ? __('Add campaigns to it with wconvert/create-campaign and this occasion_id.', 'wconvert')
                : __('Saved. Published campaigns keep their live dates until they are published again.', 'wconvert'),
        ];
    }

    /** Shift one campaign's draft dates by whole days; null when done, else why not. */
    private function move(string $campaignId, int $days): ?string
    {
        $raw = $this->reader->raw($campaignId);
        if ($raw === null) return __('It no longer exists.', 'wconvert');
        $config = is_array($raw['config'] ?? null) ? $raw['config'] : [];
        foreach (['starts_at', 'ends_at'] as $key) {
            if (!is_string($config[$key] ?? null)) continue;
            $wall = \DateTimeImmutable::createFromFormat('!' . Schedule::FORMAT, $config[$key], new \DateTimeZone('UTC'));
            if ($wall !== false) $config[$key] = $wall->modify(sprintf('%+d days', $days))->format(Schedule::FORMAT);
        }
        $result = InternalRest::run('PATCH', '/optins/' . $campaignId, ['config' => $config, 'expected_revision' => $this->reader->describe($raw)['revision']]);
        return InternalRest::failed($result) ? InternalRest::message($result, __('It could not be saved.', 'wconvert')) : null;
    }

    /** An id from the name, with the start's year where the name has none. */
    private static function idFor(string $name, string $start): string
    {
        $slug = trim((string) preg_replace('/[^a-z0-9]+/', '-', strtolower(remove_accents($name))), '-');
        if (!preg_match('/\d{4}/', $slug)) $slug = trim($slug . '-' . substr($start, 0, 4), '-');
        return substr($slug === '' ? 'occasion' : $slug, 0, 59);
    }
}

<?php

namespace WConvert\Agent\Draft;

use WConvert\Agent\Ability;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Read\ListOccasions;
use WConvert\Agent\Reply;
use WConvert\Rest\InternalRest;
use WP_Error;

defined('ABSPATH') || exit;

/** Copy to next year (ADR 0153): the occasion a year on, with a draft of each campaign. */
final class CopyOccasion implements Ability
{
    use ManagersOnly;

    public function name(): string
    {
        return 'wconvert/copy-occasion';
    }

    public function definition(): array
    {
        return [
            'label' => __('Copy an occasion to next year', 'wconvert'),
            'description' => __('Copies a WConvert occasion to next year, as WConvert → Occasions → Copy to next year does: a new occasion one year later (the year in its name moves too) with a DRAFT of each of its campaigns, their dates moved a year. The original is not changed and nothing is published. A sale tied to a weekday, such as Black Friday, needs its new dates checked: move them with wconvert/save-occasion and move_campaigns. Example: {"occasion_id": "black-friday-2026"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'occasion_id' => ['type' => 'string', 'description' => 'The occasion to copy, from wconvert/list-occasions.'],
            ], ['occasion_id']),
            'annotations' => ['readonly' => false, 'destructive' => false, 'idempotent' => false],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        $id = (string) $input['occasion_id'];
        if (preg_match('/^[a-z0-9-]{1,64}$/D', $id) !== 1) {
            return Reply::notFound(__('No occasion has that occasion_id. List them with wconvert/list-occasions.', 'wconvert'));
        }
        $result = InternalRest::run('POST', '/occasions/' . $id . '/copy');
        if (InternalRest::failed($result) || !is_array($result['data'])) {
            if ($result['status'] === 404) return Reply::notFound(__('No occasion has that occasion_id. List them with wconvert/list-occasions.', 'wconvert'));
            return Reply::fromRest($result, __('This occasion could not be copied.', 'wconvert'));
        }
        $data = $result['data'];
        return [
            'occasion' => ListOccasions::describe($data['occasion']),
            'created' => array_map(static fn (array $draft): array => ['campaign_id' => $draft['id'], 'name' => $draft['name']], $data['created']),
            'failed' => $data['failed'],
            'next' => __('The campaigns are drafts. Check the new dates (a weekday sale moves), then review each with wconvert/review-campaign.', 'wconvert'),
        ];
    }
}

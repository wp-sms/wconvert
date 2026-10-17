<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\CampaignReader;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Discovery\OccasionStore;
use WConvert\Rest\InternalRest;
use WP_Error;

defined('ABSPATH') || exit;

/** One occasion with its campaigns, or the document Export writes for it. */
final class GetOccasion implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly OccasionStore $occasions,
        private readonly CampaignReader $reader,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/get-occasion';
    }

    public function definition(): array
    {
        return [
            'label' => __('Get an occasion', 'wconvert'),
            'description' => __('Reads one WConvert occasion and the campaigns in it. format "summary" (the default) gives each campaign\'s name, status, display type and schedule. format "export" gives the occasion file WConvert → Occasions → Export writes: each campaign\'s design id, words by slot role, link, pages, frequency and dates — the same document another site can import. A design that is not in the library reads as "custom" and is not included. Example: {"occasion_id": "black-friday-2026", "format": "summary"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'occasion_id' => ['type' => 'string', 'description' => 'The occasion, from wconvert/list-occasions.'],
                'format' => ['type' => 'string', 'enum' => ['summary', 'export'], 'default' => 'summary', 'description' => 'summary, or export for the occasion file.'],
            ], ['occasion_id']),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array|WP_Error
    {
        $id = (string) $input['occasion_id'];
        $occasion = $this->occasions->find($id);
        if ($occasion === null) {
            return Reply::notFound(__('No occasion has that occasion_id. List them with wconvert/list-occasions.', 'wconvert'));
        }
        if (($input['format'] ?? 'summary') === 'export') {
            $result = InternalRest::run('GET', '/occasions/' . $id . '/export');
            if (InternalRest::failed($result) || !is_array($result['data'])) {
                return Reply::refused(InternalRest::message($result, __('This occasion could not be exported.', 'wconvert')));
            }
            $document = $result['data'];
            foreach ($document['campaigns'] ?? [] as $index => $campaign) {
                // A design from outside the library travels whole in the file; an agent gets its name only.
                if (isset($campaign['template'])) {
                    unset($document['campaigns'][$index]['template']);
                    $document['campaigns'][$index]['design'] = 'custom';
                }
            }
            return ['document' => $document, 'next' => __('Copy it to next year with wconvert/copy-occasion.', 'wconvert')];
        }
        $campaigns = array_values(array_filter($this->reader->all(), static fn (array $row): bool => ($row['occasion']['occasion_id'] ?? null) === $id));
        return ListOccasions::describe($occasion) + [
            'timezone' => Reply::timezone(),
            'campaigns' => array_map(static function (array $row): array {
                unset($row['occasion']);
                return $row;
            }, $campaigns),
            'next' => $campaigns === []
                ? __('No campaign in it yet. Add one with wconvert/create-campaign and this occasion_id; its dates are filled from the occasion.', 'wconvert')
                : __('See how it is doing with wconvert/get-stats and this occasion_id.', 'wconvert'),
        ];
    }
}

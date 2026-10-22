<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Discovery\SetupIndex;
use WConvert\Goal\Goal;
use WConvert\Goal\GoalRegistry;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Template\TemplateLibrary;

defined('ABSPATH') || exit;

/** The ready-made starters ([[Playbook]]s) for one goal. */
final class ListStarters implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly PlaybookLibrary $playbooks,
        private readonly SetupIndex $index,
        private readonly TemplateLibrary $library,
        private readonly GoalRegistry $goals,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/list-starters';
    }

    public function definition(): array
    {
        return [
            'label' => __('List starters', 'wconvert'),
            'description' => __('Lists WConvert starters for one goal. A starter is a ready-made campaign — a design with tested words, rules and pages already filled in — that a person picks in WConvert → Add campaign. Pass a starter_id to wconvert/create-campaign instead of a design_id to begin from it; any copy you give replaces its words role by role. availability "ready" means this site can use it; "locked" needs WConvert Pro; "unavailable" needs a plugin the site does not have. Goals: grow_email_list, grow_sms_list, increase_basket_value, recover_cart, promote_offer, show_message, deliver_lead_magnet, collect_enquiries, find_match. Example: {"goal": "promote_offer"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'goal' => ['type' => 'string', 'enum' => array_map(static fn (Goal $goal): string => $goal->value, Goal::cases()), 'description' => 'What the campaign is for.'],
            ], ['goal']),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array
    {
        $goal = Goal::from((string) $input['goal']);
        $starters = [];
        foreach ($this->playbooks->servicing($goal) as $playbook) {
            $entry = $this->index->entry($playbook);
            $design = $this->library->find($playbook->templateId);
            $starters[] = [
                'starter_id' => $playbook->id,
                'name' => $playbook->name,
                'display_type' => $playbook->displayType,
                'design' => ['design_id' => $playbook->templateId, 'name' => (string) ($design['name'] ?? $playbook->templateId)],
                'availability' => $entry['availability'],
                'still_to_do' => $entry['requirements'],
                'notes' => $playbook->notes,
            ];
        }
        return [
            'goal' => $goal->value,
            'goal_availability' => $this->goals->availabilityOf($goal)->value,
            'starters' => $starters,
            'next' => __('Make a draft from one with wconvert/create-campaign and its starter_id.', 'wconvert'),
        ];
    }
}

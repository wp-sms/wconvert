<?php

namespace WConvert\Agent\Read;

use WConvert\Agent\Ability;
use WConvert\Agent\DesignFacts;
use WConvert\Agent\ManagersOnly;
use WConvert\Agent\Reply;
use WConvert\Goal\Goal;
use WConvert\Optin\DisplayType;
use WConvert\Support\ProPresence;
use WConvert\Support\Tier;
use WConvert\Template\CampaignBuilder;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/** The designs this site can run, with the slot roles each one takes words for. */
final class FindDesigns implements Ability
{
    use ManagersOnly;

    public function __construct(
        private readonly TemplateLibrary $library,
        private readonly TemplateVocabulary $vocabulary,
        private readonly CampaignBuilder $builder,
        private readonly ProPresence $pro,
    ) {
    }

    public function name(): string
    {
        return 'wconvert/find-designs';
    }

    public function definition(): array
    {
        return [
            'label' => __('Find designs', 'wconvert'),
            'description' => __('Lists the WConvert designs this site can use for a new campaign. A design is the layout and style; the words go in by slot role, and slot_roles lists the roles each design takes (headline, body, cta_label, code_value…). Only designs this site can run are listed. has_link_button means the campaign needs a link; has_countdown means it needs an end date (ends_at); has_code means it shows a discount code (put it in code_value). Filter by display_type and by goal to get designs that suit it. Pass a design_id to wconvert/create-campaign. Example: {"display_type": "floating_bar", "goal": "promote_offer"}.', 'wconvert'),
            'input_schema' => Reply::input([
                'display_type' => ['type' => 'string', 'enum' => array_map(static fn (DisplayType $type): string => $type->value, DisplayType::cases()), 'description' => 'popup, floating_bar, slide_in, fullscreen or inline.'],
                'goal' => ['type' => 'string', 'enum' => array_map(static fn (Goal $goal): string => $goal->value, Goal::cases()), 'description' => 'Only designs that can serve this goal.'],
                'search' => ['type' => 'string', 'description' => 'Words in the design name.'],
            ] + Reply::pageSchema()),
            'annotations' => ['readonly' => true, 'destructive' => false, 'idempotent' => true],
        ];
    }

    public function execute(array $input): array
    {
        $goal = isset($input['goal']) ? Goal::tryFrom((string) $input['goal']) : null;
        $search = mb_strtolower(trim((string) ($input['search'] ?? '')));
        $designs = [];
        foreach ($this->library->all() as $id => $entry) {
            $type = (string) ($entry['display_type'] ?? 'popup');
            if (!(Tier::tryFrom((string) ($entry['tier'] ?? 'free')) ?? Tier::Free)->isSuppliedBy($this->pro) || !$this->builder->displayTypeRuns($type)) continue;
            if (isset($input['display_type']) && $type !== $input['display_type']) continue;
            if ($goal !== null && $goal->outcome()->designIssue(['template' => $entry]) !== null) continue;
            if ($search !== '' && !str_contains(mb_strtolower((string) $entry['name']), $search)) continue;
            $designs[] = [
                'design_id' => (string) $id,
                'name' => (string) $entry['name'],
                'display_type' => $type,
                'converts_on' => $entry['facets']['act'] ?? null,
                'captures' => $entry['facets']['captures'] ?? [],
                'slot_roles' => SlotRoles::declaredIn($entry['tree'] ?? [], $this->vocabulary),
            ] + DesignFacts::of($entry['tree'] ?? null);
        }
        return Reply::paged($designs, $input) + [
            'next' => __('Make a draft with wconvert/create-campaign and a design_id, giving words for its slot_roles. Or start from a ready-made starter with wconvert/list-starters.', 'wconvert'),
        ];
    }
}

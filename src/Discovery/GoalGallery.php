<?php

namespace WConvert\Discovery;

use WConvert\Admin\ProHints;
use WConvert\Goal\Goal;
use WConvert\Playbook\FlagshipCollection;
use WConvert\Playbook\Playbook;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Support\ProPresence;
use WConvert\Template\Catalog\TemplateCatalog;

defined('ABSPATH') || exit;

/**
 * Everything step 2 offers for one Goal, in one answer (ADR 0171): this site's
 * setups in recommended order, the online ones it could add, and whether the
 * library may be asked at all.
 */
final class GoalGallery
{
    public function __construct(
        private readonly PlaybookLibrary $playbooks,
        private readonly SetupIndex $setups,
        private readonly ProPresence $pro,
        private readonly ?TemplateCatalog $catalog = null,
    ) {
    }

    /** @return array{setups: list<array<string, mixed>>, online: list<array<string, mixed>>, library: array{configured: bool, consent: string}} */
    public function of(Goal $goal): array
    {
        $setups = array_map(fn (Playbook $playbook): array => $this->setup($playbook), FlagshipCollection::prioritize($this->playbooks->servicing($goal)));

        $status = $this->catalog?->status();

        return [
            'setups' => $setups,
            'online' => $status === null ? [] : $this->online($goal, $status),
            // `enabled` is TemplateCatalog::configured(): switched on and given a source.
            'library' => ['configured' => (bool) ($status['enabled'] ?? false), 'consent' => (string) ($status['consent'] ?? 'unanswered')],
        ];
    }

    /**
     * One local setup as the gallery and its previews describe it: the index
     * entry, plus the editorial recommendation where there is one.
     *
     * @return array<string, mixed>
     */
    public function setup(Playbook $playbook): array
    {
        $entry = $this->setups->entry($playbook);
        $recommendation = FlagshipCollection::recommendation($playbook->id);
        if ($recommendation !== null) $entry['recommendation'] = $recommendation;
        return $entry;
    }

    /**
     * The library's setups for this Goal that this site does not have yet.
     *
     * Nothing without consent — the catalogue's own status already holds that
     * line. A locked row is a hint, so it follows `ProHints::shown()` exactly as
     * the design index does; a row already installed is drawn as the local
     * setup it became.
     *
     * @param array<string, mixed> $status
     * @return list<array<string, mixed>>
     */
    private function online(Goal $goal, array $status): array
    {
        if ($status['consent'] !== 'yes') return [];
        $designs = array_column($status['designs'], null, 'id');
        $hints = ProHints::shown($this->pro);
        $rows = [];
        foreach ($status['setups'] as $setup) {
            if ($setup['goal'] !== $goal->value || $setup['state'] === 'ready') continue;
            if ($setup['state'] === 'locked' && !$hints) continue;
            $design = $designs[$setup['design']['id']] ?? null;
            if ($design === null) continue;
            $rows[] = [
                'id' => $setup['id'], 'revision' => $setup['revision'], 'sha256' => $setup['sha256'], 'name' => $setup['name'],
                'goal' => $setup['goal'], 'tier' => $setup['tier'], 'state' => $setup['state'],
                'installed_playbook_id' => $setup['installed_playbook_id'],
                'business_types' => Playbook::businessTypes($setup['business_types']),
                'design' => ['id' => $design['id'], 'name' => $design['name'], 'tier' => $design['tier']],
                'display_type' => $design['format'], 'facets' => $design['facets'], 'thumbnail' => $design['thumbnail'],
                'tags' => $design['tags'], 'preview_url' => TemplateCatalog::previewUrl((string) $design['slug']),
            ];
        }
        return $rows;
    }
}

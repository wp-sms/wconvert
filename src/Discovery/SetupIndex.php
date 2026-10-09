<?php

namespace WConvert\Discovery;

use WConvert\Playbook\Playbook;
use WConvert\Support\Availability;
use WConvert\Support\ProPresence;
use WConvert\Support\Tier;
use WConvert\Template\TemplateLibrary;

defined('ABSPATH') || exit;

/** Metadata only. Preparation continues to belong exclusively to Prefill. */
final class SetupIndex
{
    public function __construct(private readonly TemplateLibrary $templates, private readonly ProPresence $pro) {}

    /** @return array<string, mixed> */
    public function entry(Playbook $playbook): array
    {
        $design = $this->templates->find($playbook->templateId);
        $stub = $this->templates->locked()[$playbook->templateId] ?? null;
        $entry = $playbook->toArray();
        $revision = hash('sha256', (string) wp_json_encode([$entry, $design], JSON_THROW_ON_ERROR));
        unset($entry['copy']);
        $entry['revision'] = $revision;
        $entry['design_key'] = $design['design_key'] ?? 'registered:' . $playbook->templateId;
        $entry['availability'] = Availability::of($design !== null || $stub !== null,
            $stub === null && (Tier::tryFrom((string) ($design['tier'] ?? 'free')) ?? Tier::Free)->isSuppliedBy($this->pro))->value;
        // Only what the merchant still has to do: a design that already meets
        // its Goal's publication rule does not repeat the rule back (ADR 0087).
        $outcome = $playbook->goal->outcome();
        $entry['requirements'] = $design === null || $outcome->designIssue(['template' => $design]) !== null
            ? [$outcome->requirement] : [];
        return $entry;
    }
}

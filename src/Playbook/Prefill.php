<?php

namespace WConvert\Playbook;

use WConvert\Goal\Goal;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/**
 * Picking a [[Playbook]] prefills a new [[Optin]] **by snapshot**.
 *
 * ============================================================================
 * THIS IS THE SNAPSHOT BOUNDARY THAT ALREADY EXISTS.
 * ============================================================================
 * An Optin takes a COPY of its [[Template]], taken when the Template was
 * picked, and the renderer and the vocabulary stay a live reference
 * (ADR 0010). Prefill is that same mechanism with the words filled in: it
 * calls {@see TemplateLibrary::snapshotInto()} for the design and then writes
 * the Playbook's copy into the result. There is no second snapshot, no second
 * boundary and nothing else to keep in step.
 *
 * The consequence is the one CONTEXT.md states: the values are copied into the
 * Optin and **the two never speak again**. Improving a Playbook never rewrites
 * the words on a running Optin, and deleting one leaves every Optin it started
 * untouched — so `playbook_id` is *provenance*, exactly as `template_id` is,
 * and nothing joins on either.
 *
 * > **Provenance is not performance.** Two Optins from one Playbook may have
 * > been edited into unrecognisably different things, so rolling their
 * > [[Conversion]]s up measures the edits rather than the Playbook. The metric
 * > is "Optins started from this Playbook", never "this Playbook's conversion
 * > rate".
 *
 * **It persists nothing.** What comes back is a draft the merchant has not
 * saved: a name, a [[Goal]] and a `config`, in exactly the shape
 * `POST /wconvert/v1/optins` takes. A merchant who browses the gallery and
 * closes the tab has created nothing.
 *
 * Degradation is deliberately NOT here. ADR 0012 names prefill as one of the
 * two call sites for the substitution resolver, and that resolver lands with
 * the ticket that writes it; what this does with a Playbook's rules is copy
 * them.
 *
 * @since 0.1.0
 */
final class Prefill
{
    public function __construct(
        private readonly PlaybookLibrary $playbooks,
        private readonly TemplateLibrary $templates,
        private readonly TemplateVocabulary $vocabulary,
    ) {
    }

    /**
     * A draft from one Playbook, or null where this install has no such entry.
     *
     * @return array{name: string, goal: string, config: array<string, mixed>}|null
     */
    public function fromPlaybook(string $playbookId): ?array
    {
        $playbook = $this->playbooks->find($playbookId);

        if ($playbook === null) {
            return null;
        }

        // The design first, with every word already taken out of it —
        // `snapshotInto()` strips copy, because a Template carries none and
        // its placeholder text is for the gallery (CONTEXT.md, Template).
        $config = $this->templates->snapshotInto(['template_id' => $playbook->templateId]);

        // Then the words, bound to [[Slot Role]]s rather than to this
        // Template's nodes — which is what lets the merchant switch Template
        // afterwards and keep them (CONTEXT.md, Slot Role).
        $config['template']['tree'] = SlotRoles::bind(
            $config['template']['tree'] ?? [],
            $playbook->copy,
            $this->vocabulary
        );

        // Validated exactly as a save would validate it, so what prefill hands
        // back is byte-identical to what storing it produces. Anything else
        // and the preview would render one thing and the saved Optin another.
        $config['template'] = $this->vocabulary->normalize($config['template']);

        $config['playbook_id'] = $playbook->id;
        $config['display_type'] = $playbook->displayType;
        $config['rules'] = $playbook->rules;

        if ($playbook->targeting !== []) {
            $config['targeting'] = $playbook->targeting;
        }

        // The hint travels; no Destination is bound. It names Destination
        // TYPES and the [[Lead]] fields the Playbook needs, and choosing an
        // actual Destination is a decision the merchant makes with the list in
        // front of them.
        if ($playbook->destinationHint !== []) {
            $config['destination_hint'] = $playbook->destinationHint;
        }

        return ['name' => $playbook->name, 'goal' => $playbook->goal->value, 'config' => $config];
    }

    /**
     * A draft with no Playbook behind it.
     *
     * **"Start from scratch" skips the Playbook, never the Goal.** So there is
     * no `playbook_id` and no Template — the merchant picks one in the builder
     * — and the Goal is already chosen, because it is the one thing that is
     * decided before anything else is configured.
     *
     * It still carries a Trigger. Every Optin has at least one and "shows
     * immediately" is the explicit `page_load` Trigger rather than an empty
     * list: an Optin with no Triggers can never fire, which is a silent, total
     * loss of function with nothing in any log (ADR 0012).
     *
     * @return array{name: string, goal: string, config: array<string, mixed>}
     */
    public function fromScratch(Goal $goal): array
    {
        return [
            'name' => $goal->label(),
            'goal' => $goal->value,
            'config' => ['rules' => [['type' => 'page_load']]],
        ];
    }
}

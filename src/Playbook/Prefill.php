<?php

namespace WConvert\Playbook;

use WConvert\Goal\Goal;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Rules\Degradation;
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
 * ============================================================================
 * AND IT IS THE FIRST OF DEGRADATION'S TWO CALL SITES (ADR 0012).
 * ============================================================================
 * **Prefill exists for authoring honesty.** wp.org Guideline 9 fires on
 * showing a real control `disabled`, so a free user must be handed a working
 * rule they can configure rather than a locked one they cannot — which is why
 * a [[Playbook]] asking for `exit_intent` on an install without [[Pro]] gets
 * `time_on_page`, with a `degraded_from` marker beside it saying so.
 *
 * **This is the only call site that WRITES**, so it is the only one that
 * records a marker. Enqueue, the other, resolves a published Optin on its way
 * to the page and persists nothing — there is nowhere for it to put one, and
 * the case it covers needs none: the premium rule is still sitting in
 * `config`, at its own tier, and the builder's rule row says so already.
 *
 * The two therefore never touch the same Optin — prefill covers those authored
 * on an install without Pro, enqueue those authored with it and now running
 * without — and prefill baking the substitution in is what makes the second
 * pass a no-op on anything the first one touched.
 *
 * @since 0.1.0
 */
final class Prefill
{
    public function __construct(
        private readonly PlaybookLibrary $playbooks,
        private readonly TemplateLibrary $templates,
        private readonly TemplateVocabulary $vocabulary,
        private readonly Degradation $degradation,
        private readonly ?PrivacyGuidance $privacyGuidance = null,
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
        $copy = $this->privacyGuidance?->copyFor($playbook->copy) ?? $playbook->copy;
        $config['template']['tree'] = SlotRoles::bind(
            $config['template']['tree'] ?? [],
            $copy,
            $this->vocabulary
        );
        if ($this->privacyGuidance !== null) {
            $config['template']['tree'] = $this->privacyGuidance->treeFor(
                $config['template']['tree'],
                $playbook->goal
            );
        }

        // Validated exactly as a save would validate it, so what prefill hands
        // back is byte-identical to what storing it produces. Anything else
        // and the preview would render one thing and the saved Optin another.
        $config['template'] = $this->vocabulary->normalize($config['template']);

        $config['playbook_id'] = $playbook->id;
        $config['display_type'] = $playbook->displayType;
        // The rules the Playbook asked for, resolved against what this install
        // can actually run. On a Pro install nothing changes; on a free one a
        // premium [[Trigger]] is substituted and marked, and a premium
        // [[Condition]] is dropped — which only widens the audience, the safe
        // direction to fail in (ADR 0012).
        $config['rules'] = $this->degradation->intoConfig($playbook->rules);

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

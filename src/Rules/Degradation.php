<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/** Catalog prefill may offer visible alternatives. Authored campaigns suspend if any capability is lost. */
final class Degradation
{
    public function __construct(
        private readonly RuleVocabulary $vocabulary,
        private readonly SuppliedRules $supplied,
    ) {
    }

    /**
     * PREFILL. A [[Playbook]]'s rules, resolved against this install and ready
     * to be written into `config` — with a `degraded_from` marker beside
     * anything substituted.
     *
     * **No new storage**: the marker rides an already-approved blob, beside
     * the rule it describes.
     *
     * A rule the manifest marks `suspend` is KEPT rather than dropped, and the
     * Optin it lands on is born [[Suspended]] — visibly, with a cause, healing
     * itself the day the dependency returns. Silently dropping it would be the
     * lying popup ADR 0027 exists to prevent, arriving through the one door
     * that writes it into `config` permanently. In practice prefill never
     * reaches that case, because ADR 0026 hides the [[Goal]] above such a
     * Playbook on an install that cannot serve it.
     *
     *
     * @param mixed $rules The flat `{type, scalar}` list, as the Playbook wrote it.
     *
     * @return list<array<string, mixed>>
     */
    public function intoConfig($rules): array
    {
        return $this->resolve($rules, true)['rules'];
    }

    /**
     * @param list<array<string, mixed>> $rules
     * @return array<string, mixed> */
    public function intoDisplayConfig(array $rules): array
    {
        return DisplayPlan::fromCatalogue($this->intoConfig($rules), $this->vocabulary);
    }

    /**
     * The rule type one published Optin cannot run without, or null — asked of
     * a payload entry rather than of a flat list.
     *
     * Authored groups are scanned without changing their Boolean meaning.
     * A missing leaf suspends the whole Campaign, including an OR alternative.
     *
     * @param array<string, mixed> $entry
     */
    public function suspendedIn(array $entry): ?string
    {
        if (!isset($entry['display_rules'])) return 'display_rules';
        if (\WConvert\Template\CaptureJourney::requiresPremium($entry['template']['tree'] ?? [])
            && !\WConvert\Template\JourneySupport::active()) return 'journey_questions';
        return $this->suspendedBy([...DisplayPlan::rules($entry['display_rules']), ...($entry['required_rules'] ?? [])]);
    }

    /**
     * ENQUEUE. Keep the authored payload unchanged, or withhold the entire
     * Campaign when any required implementation is missing.
     *
     * @param array<string, mixed> $entry As {@see \WConvert\Optin\PublishedOptin::toPayloadEntry()} built it.
     *
     * @return array<string, mixed>|null
     */
    public function intoPayload(array $entry): ?array
    {
        return $this->suspendedIn($entry) === null ? $entry : null;
    }

    /**
     * LIST TIME. The rule type this Optin cannot run without, or null where it
     * runs.
     *
     * **Computed, never stored** (ADR 0027): a pure function of the Optin's
     * rules against the live registry, so it cannot drift and it adds no
     * storage. The type rather than a sentence, because *why* that type is
     * missing is [[Availability]] arithmetic belonging to the screen that
     * renders it ({@see \WConvert\Optin\Suspension}) — this class cannot tell
     * a missing tier from a missing plugin and must not guess, since one is
     * buyable from us and the other is not.
     *
     *
     * @param mixed $rules
     */
    public function suspendedBy($rules): ?string
    {
        foreach (is_array($rules) ? $rules : [] as $rule) {
            $type = (string) ($rule['type'] ?? '');
            if (!in_array($this->vocabulary->kindOf($type), [RuleKind::Visitor, RuleKind::Page], true) && !$this->supplied->supplies($type)) return $type;
        }
        return null;
    }

    /**
     * The whole resolver, once.
     *
     * ========================================================================
     * TWO LISTS COME OUT OF ONE WALK, AND THE VERDICT IS TAKEN FROM THE
     * SECOND.
     * ========================================================================
     * `$kept` is what the caller wanted — a config to write, or a payload to
     * ship. `$runnable` is the subset this install can actually EVALUATE, and
     * suspension is judged against that. Judging against `$kept` instead would
     * make the answer depend on which caller asked, and the Optin list saying
     * "running" about an Optin the payload is leaving out is the one
     * disagreement this class exists to make impossible.
     *
     * The two lists differ in exactly one case, and it is the case ADR 0012's
     * table cannot cover: a premium Trigger with **no honest substitute**.
     *
     * - **Authoring keeps it.** A [[Playbook]] may name `click_element` and
     *   leave the selector to the merchant, so dropping it hands prefill a
     *   draft with zero Triggers — which the save route then refuses, telling
     *   a merchant who picked a Playbook from a gallery that their Optin needs
     *   a Trigger. Kept, the draft saves, the Optin is [[Suspended]] with a
     *   cause on the list, the row is one click from removable, and it starts
     *   working by itself the day [[Pro]] arrives.
     * - **The payload strips it.** Free's loader has no module for it, so
     *   shipping it spends bytes on every matching page view for a rule
     *   nothing can evaluate — and the Optin is absent anyway.
     *
     * A Condition with no substitute is dropped by both, because dropping one
     * only WIDENS the audience and there is nothing for the merchant to fix.
     *
     *
     * @param mixed $rules
     *
     * @param bool $forAuthoring True at prefill — the call site that writes `config` for a person to read.
     *
     * @return array{rules: list<array<string, mixed>>, suspendedBy: string|null}
     */
    private function resolve($rules, bool $forAuthoring): array
    {
        $kept = [];
        $runnable = [];
        $suspendedBy = null;

        foreach (is_array($rules) ? $rules : [] as $rule) {
            if (!is_array($rule) || !is_string($rule['type'] ?? null)) {
                continue;
            }

            /** @var array<string, mixed> $rule */
            $type = $rule['type'];

            if ($this->supplied->supplies($type)) {
                $kept[] = $rule;
                $runnable[] = $rule;

                continue;
            }

            if ($this->vocabulary->onAbsenceOf($type) === OnAbsence::Suspend) {
                // Kept as well as recorded. The Optin is not shown either way,
                // and destroying the rule would turn a self-healing state into
                // a repair step the merchant has to notice.
                $kept[] = $rule;
                $suspendedBy ??= $type;

                continue;
            }

            $substitute = $this->vocabulary->substituteFor($type);

            // A substitute this install cannot evaluate either is not one. The
            // manifest only ever names a free type, and a parity test says so;
            // asked rather than assumed, because the alternative is a rule
            // nothing can run in place of a rule nothing can run.
            if ($substitute !== null && $this->supplied->supplies((string) $substitute['type'])) {
                $kept[] = $forAuthoring ? $substitute + [RuleVocabulary::DEGRADED_FROM => $type] : $substitute;
                $runnable[] = $substitute;

                continue;
            }

            // Nothing to run in its place. It never joins `$runnable`, so the
            // post-condition below sees it go whichever list it lands in.
            if ($forAuthoring && $this->vocabulary->kindOf($type) === RuleKind::Trigger) {
                $kept[] = $rule;
            }
        }

        return [
            'rules' => $kept,
            'suspendedBy' => $suspendedBy ?? $this->lostItsLastTrigger($rules, $runnable),
        ];
    }

    /**
     * Did degradation take away the last Trigger this Optin could act on?
     *
     * Asked as a BEFORE-AND-AFTER rather than as "does it have one now", so an
     * Optin that already had no usable Trigger is not blamed on degradation.
     * That state is refused at save ({@see \WConvert\Rest\OptinController})
     * and at Playbook registration, and calling it a suspension here would
     * report a bug as a missing dependency.
     *
     *
     * @param mixed $before
     *
     * @param list<array<string, mixed>> $runnable What is left that this install can evaluate.
     */
    private function lostItsLastTrigger($before, array $runnable): ?string
    {
        if (!$this->vocabulary->hasTrigger($before) || $this->vocabulary->hasTrigger($runnable)) {
            return null;
        }

        // The Trigger that went. Named rather than reported as "Pro", so the
        // list screen resolves the cause from the type the same way for every
        // rule and this stays true when a Trigger's dependency is not Pro.
        foreach (is_array($before) ? $before : [] as $rule) {
            $type = is_array($rule) ? ($rule['type'] ?? null) : null;

            if (is_string($type)
                && $this->vocabulary->kindOf($type) === RuleKind::Trigger
                && !$this->supplied->supplies($type)
            ) {
                return $type;
            }
        }

        return null;
    }
}

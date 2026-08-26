<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/**
 * =============================================================================
 * LOSING PRO DEGRADES RATHER THAN STOPS — AND WHERE DEGRADING WOULD MAKE AN
 * OPTIN LIE, IT SUSPENDS INSTEAD.
 * =============================================================================
 * The thin resolver ADR 0012 describes, reading the table ADR 0012 puts in the
 * rule manifest, applied at the two call sites ADR 0012 names. It is
 * asymmetric by rule kind, and the asymmetry is the whole design:
 *
 * - **A premium [[Trigger]] is substituted** — `exit_intent` → `time_on_page`,
 *   `scroll_up` → `scroll_depth`. Every Optin carries at least one Trigger, so
 *   a *dropped* one leaves an Optin that can never fire: a silent, total loss
 *   of function with nothing in any log.
 * - **A premium [[Condition]] is dropped.** There is no honest substitute for
 *   "the referrer is Google", and inventing one fabricates targeting nobody
 *   asked for. Dropping only *widens* the audience, which is the safe
 *   direction to fail in.
 * - **Except where the manifest says `on_absence: suspend`** (ADR 0027), for a
 *   Condition whose guarantee the Optin's copy asserts. Dropping *"You left 3
 *   items in your cart"*'s Condition does not widen an audience, it makes the
 *   Optin say something false.
 *
 * =============================================================================
 * AND THE POST-CONDITION THAT MAKES "SUBSTITUTED" MORE THAN A TABLE ENTRY.
 * =============================================================================
 * **Degradation never turns an Optin that could fire into one that cannot.**
 * The table is what closes the case where an honest substitute exists;
 * `click_element` has none, because its selector names something only one site
 * has. So the rule is checked at the end rather than trusted from the table:
 * an Optin whose rules named a Trigger going in, and name none that could fire
 * coming out, is **[[Suspended]]** — the same outcome as the silent loss, with
 * a cause the merchant can read on the list screen and no repair step when the
 * dependency returns.
 *
 * That is a narrowing of ADR 0012 in the same shape ADR 0027 already narrowed
 * it, and it is recorded inline in both.
 *
 * =============================================================================
 * WHY THERE IS NO ENTITLEMENT BRANCH HERE.
 * =============================================================================
 * The question asked of every rule is *"can this install evaluate this type?"*,
 * and it is answered by {@see SuppliedRules} — a registry free fills from the
 * manifest's free tier and [[Pro]] fills from its own. Not "is Pro loaded", not
 * a licence, not a tier: **a set-membership test against what actually
 * registered** (ADR 0015). The grounding is a fact about this request rather
 * than a decision about a customer, which is what lets the strip live on the
 * enqueue path ADR 0012 puts it on without putting a branch on it — the thing
 * ADR 0004 spends the whole loader design avoiding, and what
 * `tests/unit/Contract/NoLicenceOnTheFrontEndTest.php` reads the source to
 * keep true.
 *
 * =============================================================================
 * TWO CALL SITES, AND THEY NEVER TOUCH THE SAME OPTIN.
 * =============================================================================
 * **{@see intoConfig()} is prefill**, and exists for authoring honesty:
 * wp.org Guideline 9 fires on showing a real control `disabled`, so a free
 * user is handed a working rule they can configure. It is the only call site
 * that WRITES, so it is the only one that records the `degraded_from` marker.
 *
 * **{@see intoPayload()} is enqueue**, and exists for runtime correctness of
 * Optins authored while Pro was installed and running after it is gone. It
 * writes nothing — the published set outlives the code that reads it — so
 * there is no marker for it to record, and the note the builder shows for that
 * case needs none: the rule is still sitting in `config`, at its own tier.
 *
 * They are disjoint by MOMENT rather than by guard, and prefill baking the
 * substitution in is what makes the second pass a no-op on an Optin the first
 * one touched.
 *
 * @since 0.1.0
 */
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
     * @param mixed $rules The flat `{type, scalar}` list, as the Playbook wrote it.
     * @return list<array<string, mixed>>
     */
    public function intoConfig($rules): array
    {
        return $this->resolve($rules, true)['rules'];
    }

    /**
     * ENQUEUE. One payload entry, degraded — or **null where the Optin is
     * Suspended and this page must not carry it at all**.
     *
     * Both axes are resolved together and re-partitioned, because a
     * substitution is a rule swap and kind is a fixed property of the type: a
     * Trigger's substitute is a Trigger, and the manifest is what says so
     * rather than the axis the rule happened to arrive on.
     *
     * @param array<string, mixed> $entry As {@see \WConvert\Optin\PublishedOptin::toPayloadEntry()} built it.
     * @return array<string, mixed>|null
     */
    public function intoPayload(array $entry): ?array
    {
        $triggers = is_array($entry['triggers'] ?? null) ? $entry['triggers'] : [];
        $conditions = is_array($entry['conditions'] ?? null) ? $entry['conditions'] : [];

        $resolved = $this->resolve([...array_values($triggers), ...array_values($conditions)], false);

        if ($resolved['suspendedBy'] !== null) {
            return null;
        }

        // Assigned rather than merged, so the keys keep the position the
        // projection gave them and an entry nothing was done to comes back
        // byte-identical.
        //
        // **And an axis is never INVENTED.** The projection always writes both
        // keys, because the loader reads "no triggers" as "never fires" and
        // can only read that from a key that is present — but this is not the
        // projection, and adding a key an entry did not have would spend bytes
        // on every matching page view to say what its absence already said.
        foreach ($this->vocabulary->partition($resolved['rules']) as $axis => $rules) {
            if ($rules !== [] || array_key_exists($axis, $entry)) {
                $entry[$axis] = $rules;
            }
        }

        return $entry;
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
     * @param mixed $rules
     */
    public function suspendedBy($rules): ?string
    {
        return $this->resolve($rules, false)['suspendedBy'];
    }

    /**
     * The whole resolver, once.
     *
     * @param mixed $rules
     * @param bool $mark Whether to record `degraded_from` — true only where the result is written.
     * @return array{rules: list<array<string, mixed>>, suspendedBy: string|null}
     */
    private function resolve($rules, bool $mark): array
    {
        $kept = [];
        $suspendedBy = null;

        foreach (is_array($rules) ? $rules : [] as $rule) {
            if (!is_array($rule) || !is_string($rule['type'] ?? null)) {
                continue;
            }

            /** @var array<string, mixed> $rule */
            $type = $rule['type'];

            if ($this->supplied->supplies($type)) {
                $kept[] = $rule;

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
                $kept[] = $mark ? $substitute + [RuleVocabulary::DEGRADED_FROM => $type] : $substitute;

                continue;
            }

            // Dropped — which for a Condition only widens the audience, and
            // for a Trigger is caught by the post-condition below.
        }

        return [
            'rules' => $kept,
            'suspendedBy' => $suspendedBy ?? $this->lostItsLastTrigger($rules, $kept),
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
     * @param mixed $before
     * @param list<array<string, mixed>> $after
     */
    private function lostItsLastTrigger($before, array $after): ?string
    {
        if (!$this->vocabulary->hasTrigger($before) || $this->vocabulary->hasTrigger($after)) {
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

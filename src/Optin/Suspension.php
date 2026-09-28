<?php

namespace WConvert\Optin;

use WConvert\Rules\Degradation;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleLabels;
use WConvert\Support\Availability;
use WConvert\Support\SiteDependency;

defined('ABSPATH') || exit;

/**
 * Why an [[Optin]] is [[Suspended]], in words the merchant can act on.
 *
 * ============================================================================
 * COMPUTED, VISIBLE, SILENT, SELF-HEALING (ADR 0027).
 * ============================================================================
 * {@see Degradation} owns *computed* and *silent*: it is a pure function of an
 * Optin's rules against the live registry, evaluated at enqueue and here, and
 * a suspended Optin is simply absent from the payload. **This class is
 * *visible*** — the half ADR 0027 says makes ADR 0026's silent goal screen
 * acceptable, because the Optin list is the screen a merchant actually looks
 * at when something stopped working.
 *
 * *Self-healing* is nobody's, and that is the point: there is no state to
 * unwind. Nothing is stored, so reactivating [[Pro]] needs no repair step —
 * the next request simply computes a different answer.
 *
 * **The cause is resolved from [[Availability]], not asserted.** Degradation
 * reports the rule type it could not run and stops there, because the code
 * that did not run cannot say why it did not — and here the difference is the
 * whole of ADR 0026: `locked` is buyable from us and `unavailable` is not, so
 * collapsing them offers a merchant a WooCommerce licence we do not have.
 * The arithmetic is {@see RuleCatalogue::availabilityOf()}'s, shared rather
 * than repeated.
 *
 * **It is a sentence rather than a code the admin bundle maps.** The words
 * belong where `wp i18n make-pot` can see them, which is the same reason
 * {@see RuleLabels} holds the rule names — and unlike a [[Goal]] label there
 * is no registry for the client to fetch and key against.
 *
 * @since 0.1.0
 */
final class Suspension
{
    private function __construct(
        /** The rule type this Optin cannot run without. */
        public readonly string $rule,
        /**
         * What the SITE is missing, or **null where the cause is the tier**.
         *
         * ====================================================================
         * ONE FIELD, BECAUSE THERE ARE ONLY TWO CAUSES AND THIS TELLS THEM
         * APART.
         * ====================================================================
         * A suspended Optin holds a rule this install cannot evaluate, and
         * there are exactly two reasons a rule type is not supplied: the
         * install lacks the tier, or the site lacks the dependency
         * ({@see \WConvert\Rules\RuleVocabulary::typesAt()} filters on both,
         * and nothing else). So "which dependency is missing, if any" is the
         * whole question, and null means the other one.
         *
         * It replaced an {@see Availability} carried beside it, which let this
         * class hold a pair that cannot occur — `unavailable` with nothing to
         * name — and earned a third `reason()` branch for it that no test
         * could reach and no merchant could ever read. The arithmetic is still
         * shared and the precedence is still `Availability::of()`'s; what
         * changed is that {@see RuleCatalogue::missingDependencyOf()} answers
         * with the cause rather than with two coordinates to recombine here.
         */
        public readonly ?SiteDependency $dependency,
    ) {
    }

    /**
     * Why each suspended Optin in the published set is suspended, by id.
     *
     * The batch form is the primary one, because the surface is a LIST: the
     * Optin list resolves every row in one pass over the option the front end
     * already reads whole, rather than asking per row.
     *
     * Asked of the PUBLISHED set rather than of the drafts, deliberately.
     * Suspension is a statement about what the site is SERVING; a draft is not
     * being served at all, and calling one suspended would put a scary word on
     * an Optin whose author has simply not finished it.
     *
     * @param iterable<array<string, mixed>> $set The published set, as stored.
     * @return array<string, string> Optin id => the sentence to show, for the suspended ones only.
     */
    public static function reasonsIn(iterable $set, Degradation $degradation, RuleCatalogue $rules): array
    {
        $reasons = [];

        foreach (PublishedOptin::fromSet($set) as $optin) {
            $suspension = self::of($optin, $degradation, $rules);

            if ($suspension !== null) {
                $reasons[$optin->id] = $suspension->reason();
            }
        }

        return $reasons;
    }

    /** Whether one published Optin is suspended on this install, and why. */
    private static function of(PublishedOptin $optin, Degradation $degradation, RuleCatalogue $rules): ?self
    {
        $rule = $degradation->suspendedIn($optin->toPayloadEntry());

        return $rule === null ? null : new self($rule, $rules->missingDependencyOf($rule));
    }

    /**
     * The state and its cause, in one line — *"Suspended — WConvert Pro is not
     * active"*.
     *
     * One string rather than a state plus a reason, because the two are never
     * shown apart: an Optin that does not show is a merchant asking *why*, and
     * a list that answered only the first half would be the screen that made
     * them ask.
     */
    public function reason(): string
    {
        if ($this->rule === 'journey_questions') {
            return __('Suspended — this question journey needs WConvert Pro, which is not active.', 'wconvert');
        }
        // **Not an upsell, and never one**: a rule the SITE cannot serve is
        // not something we can sell (ADR 0026). Reachable as of #36, whose two
        // cart Conditions are the first rule types to declare a
        // [[SiteDependency]] — and it NAMES the dependency, because “not
        // available on this site” leaves a merchant who deactivated
        // WooCommerce to guess which of their plugins did it.
        //
        // First, because it is the case that must never fall through to the
        // one below: `unavailable` beats `locked`, and the branch order is
        // where a surface would otherwise get to disagree with
        // {@see \WConvert\Support\Availability::of()} about that.
        if ($this->dependency !== null) {
            return sprintf(
                /* translators: 1: the display name of the rule the Optin cannot run without. 2: the plugin the site needs, e.g. WooCommerce. */
                __('Suspended — the “%1$s” rule needs %2$s, which is not active on this site', 'wconvert'),
                RuleLabels::type($this->rule),
                $this->dependency->label()
            );
        }

        // Nothing the SITE is missing, so the tier is what is — and this is
        // the one cause that is buyable from us.
        return sprintf(
            /* translators: %s: the display name of the rule the Optin cannot run without. */
            __('Suspended — the “%s” rule needs WConvert Pro, which is not active', 'wconvert'),
            RuleLabels::type($this->rule)
        );
    }
}

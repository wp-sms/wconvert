<?php

namespace WConvert\Optin;

use WConvert\Rules\Degradation;
use WConvert\Rules\RuleCatalogue;
use WConvert\Rules\RuleLabels;
use WConvert\Support\Availability;

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
        public readonly Availability $availability,
    ) {
    }

    /**
     * Whether this published Optin is suspended on this install, and why.
     *
     * Asked of the PUBLISHED entry rather than of the draft, deliberately.
     * Suspension is a statement about what the site is serving; a draft is not
     * being served at all, and calling one suspended would put a scary word on
     * an Optin whose author has simply not finished it.
     */
    public static function of(PublishedOptin $optin, Degradation $degradation, RuleCatalogue $rules): ?self
    {
        $rule = $degradation->suspendedBy($optin->rules());

        return $rule === null ? null : new self($rule, $rules->availabilityOf($rule));
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
        if ($this->availability === Availability::Locked) {
            return sprintf(
                /* translators: %s: the display name of the rule the Optin cannot run without. */
                __('Suspended — the “%s” rule needs WConvert Pro, which is not active', 'wconvert'),
                RuleLabels::type($this->rule)
            );
        }

        // Not an upsell, and never one: a rule the SITE cannot serve is not
        // something we can sell (ADR 0026). No rule type declares a
        // [[SiteDependency]] until #36's cart Conditions, so today this is
        // unreachable — written because the alternative is a screen that
        // offers to sell a WooCommerce licence the day one does.
        return sprintf(
            /* translators: %s: the display name of the rule the Optin cannot run without. */
            __('Suspended — “%s” is not available on this site', 'wconvert'),
            RuleLabels::type($this->rule)
        );
    }
}

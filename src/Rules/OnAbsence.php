<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/**
 * What happens to an [[Optin]] holding a rule this install cannot evaluate —
 * the third property beside `tier` and `consent_category` on the rule manifest
 * (ADR 0027).
 *
 * **`drop` is the default and ADR 0012 is the rule**; `suspend` is the marked
 * exception, for a [[Condition]] whose guarantee the Optin's copy asserts.
 * Dropping one of those does not widen an audience, it makes the Optin say
 * something false — *"You left 3 items in your cart"* to somebody who has
 * never added anything.
 *
 * **This field is not where substitution lives.** A premium [[Trigger]] is
 * substituted, and the substitute is declared as its own manifest property
 * ({@see RuleVocabulary::substituteFor()}); `on_absence` answers only what
 * happens where no substitute is declared. So free's own Triggers read `drop`
 * vacuously — free is always installed, so their absence never arises.
 *
 * A closed pair rather than a string, so the manifest and the resolver cannot
 * disagree about how the two words are spelled — the same reason {@see \WConvert\Support\Tier}
 * is an enum.
 *
 * @since 0.1.0
 */
enum OnAbsence: string
{
    /**
     * The rule goes, and the Optin runs without it.
     *
     * For a Condition this only WIDENS the audience, which is the safe
     * direction to fail in. For a Trigger it is safe only because
     * {@see Degradation} refuses to leave an Optin with no Trigger it can
     * act on — dropping the last one would be a silent, total loss of
     * function with nothing in any log (ADR 0012).
     */
    case Drop = 'drop';

    /** The Optin is not shown at all while the rule is unavailable (ADR 0027). */
    case Suspend = 'suspend';
}

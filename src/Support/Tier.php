<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Which install supplies a registry member — free, or [[Pro]].
 *
 * **A type, not a list.** ADR 0015 refuses a cross-cutting vocabulary of
 * premium capabilities: "each registry declares `tier` locally on members it
 * already enumerates, so the premium split adds zero new lists". This is the
 * spelling of the two words that declaration uses, shared so the rule manifest
 * and the [[Goal]] registry cannot disagree about what "pro" is spelled like.
 * It enumerates nothing about which members are premium.
 *
 * Free ships both cases, and that is deliberate: free's PHP is what renders a
 * `locked` card and what will strip an unentitled rule at enqueue, and it can
 * only do either for a tier it can name (ADR 0005).
 *
 * @since 0.1.0
 */
enum Tier: string
{
    case Free = 'free';

    case Pro = 'pro';

    /**
     * Whether this install supplies the tier.
     *
     * Free is always supplied — a free install is not a crippled Pro install,
     * it is the whole product minus features it never carried (CONTEXT.md,
     * Pro).
     */
    public function isSuppliedBy(ProPresence $pro): bool
    {
        return $this === self::Free || $pro->isLoaded();
    }
}

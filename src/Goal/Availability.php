<?php

namespace WConvert\Goal;

defined('ABSPATH') || exit;

/**
 * Whether a member of a registry can be used on this install right now — three
 * states, and the distinction between the last two is load-bearing
 * (CONTEXT.md, Availability).
 *
 * It lives beside the [[Goal]] because a Goal is the first registry member to
 * need it, and it is not spelled per registry: a [[Trigger]] type, a
 * [[Display Type]], a [[Template]] and a [[Destination]] type all answer the
 * same question, and three states asked four times is the cross-cutting list
 * ADR 0015 refuses ("each registry declares `tier` locally on members it
 * already enumerates, so the premium split adds zero new lists"). What is
 * shared here is the ARITHMETIC, not a list of members.
 *
 * **The three states name why a member is absent. How that absence renders is
 * a property of the surface**, and no surface ever renders `unavailable` as an
 * upsell (ADR 0026). That rendering rule is not here, deliberately — it
 * belongs to whichever screen is doing the rendering, and the one screen that
 * has it is the admin's creation flow
 * (`resources/admin/src/goals/availability.ts`).
 *
 * @since 0.1.0
 */
enum Availability: string
{
    /** Present and usable. */
    case Ready = 'ready';

    /** Absent because the install does not have [[Pro]]. Buyable from us. */
    case Locked = 'locked';

    /**
     * Absent because something the *site* would need is missing: no
     * WooCommerce, no WSMS. Not buyable from us.
     */
    case Unavailable = 'unavailable';

    /**
     * One member's Availability, from the two facts that decide it.
     *
     * **`unavailable` beats `locked`**, which is the whole reason this is a
     * function rather than two booleans every surface recombines for itself. A
     * merchant with no store is never sold Pro for a feature Pro would not
     * give them either, and a surface that combined the two in its own order
     * would eventually offer exactly that (ADR 0026).
     *
     * Both arguments are facts about the install rather than about the member,
     * so this stays pure and the registry above it does the asking — the same
     * arrangement {@see \WConvert\Optin\PublishedProjection} has with the rule
     * vocabulary.
     *
     * @param bool $siteCanServeIt Whether the site has what the member needs — a store, another plugin.
     * @param bool $installHasTheTier Whether this install supplies the tier the member is declared at.
     */
    public static function of(bool $siteCanServeIt, bool $installHasTheTier): self
    {
        if (!$siteCanServeIt) {
            return self::Unavailable;
        }

        return $installHasTheTier ? self::Ready : self::Locked;
    }
}

<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Something the **site** would need for a registry member to be usable, and
 * which we cannot sell.
 *
 * This is the half of [[Availability]] that is not about [[Pro]]. The
 * distinction is load-bearing: `locked` is buyable from us and `unavailable`
 * is not, and collapsing the two shows a Pro customer an advertisement for Pro
 * and offers a merchant a WooCommerce licence we do not have (ADR 0026).
 *
 * A closed enum rather than a string on each member, so "no WooCommerce" has
 * one spelling and {@see SitePresence} has one thing to answer about. A
 * Standalone install captures phone numbers into the [[Lead]] log like any
 * other capture, so the SMS [[Goal]] needs nothing here.
 *
 * @since 0.1.0
 */
enum SiteDependency: string
{
    /**
     * A store. The cart [[Goal]] needs one, and a site without one is never
     * shown it — not greyed out, not explained, absent (ADR 0026).
     */
    case WooCommerce = 'woocommerce';

    /**
     * MailPoet, which the MailPoet [[Destination]] pushes into.
     *
     * **`unavailable` and never `locked`.** The MailPoet push ships in the
     * free plugin, so a site without it
     * is not missing a tier we sell — it is missing a plugin, and we do not
     * sell those either (ADR 0026).
     *
     * This case is why the enum is closed. Adding a member is a code change a
     * reviewer reads, rather than a string a Destination type invents for
     * itself, and {@see SitePresence} then has exactly one thing to answer
     * about each of them (#87).
     */
    case MailPoet = 'mailpoet';

    /**
     * What to call it on screen.
     *
     * Here rather than in the admin bundle because the slug is not copy: a
     * surface interpolating `mailpoet` into "Needs %s on this site" produces a
     * sentence no merchant can act on, and one built in TypeScript would be a
     * second spelling of this list that `make-pot` cannot see.
     */
    public function label(): string
    {
        return match ($this) {
            self::WooCommerce => __('WooCommerce', 'wconvert'),
            self::MailPoet => __('MailPoet', 'wconvert'),
        };
    }
}

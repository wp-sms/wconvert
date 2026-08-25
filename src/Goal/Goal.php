<?php

namespace WConvert\Goal;

use WConvert\Stats\StatKind;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;
use WConvert\Template\ConvertingAct;

defined('ABSPATH') || exit;

/**
 * The outcome an [[Optin]] exists to produce — chosen *before* anything else
 * is configured, and **kept** on the Optin for its whole life.
 *
 * ============================================================================
 * AN ENUM PLUS DATA. NO FILTER, NO REGISTRY.
 * ============================================================================
 * A Goal is the **fifth closed set this project has refused to open**. ADR 0019
 * lists the first four — the rule model (ADR 0005), the substitution table
 * (ADR 0012), the premium capability list (ADR 0015) and {@see StatKind} — and
 * the argument is the same one each time: a hand-maintained cross-cutting list
 * drifts, and drift here is worse than most, because a Goal decides what the
 * analytics screen REPORTS. A screen that cannot say what its headline number
 * means is not a screen.
 *
 * An enum rather than a `VARCHAR` validated by hand: `wconvert_optins.goal` is
 * `VARCHAR(64)` with `idx_goal`, and {@see Goal::tryFrom()} is the one place
 * the set is enforced — the same arrangement `StatKind` has over its own
 * column, and for the same reason (adding a case should be a code change a
 * reviewer reads, not a migration).
 *
 * **Each Goal declares the metric that counts it** — which [[Conversion]] is
 * the one that matters, and whether that Conversion is a [[Lead]]. That
 * declaration is applied when the analytics screen is READ, never stamped on
 * each Conversion as it happens, so correcting a mis-set Goal restates the
 * Optin's whole history rather than splitting it at the moment of the edit
 * (ADR 0020). "Kept for its whole life" means persistent, not frozen.
 *
 * **Availability is data beside each member**, not a second list: `tier` says
 * what only [[Pro]] supplies and {@see self::requires()} says what only the
 * SITE can supply. {@see GoalRegistry} resolves the two against the install
 * (ADR 0015, ADR 0026).
 *
 * @since 0.1.0
 */
enum Goal: string
{
    /** Submit-metered. The email is the [[Lead]]'s identity key. */
    case GrowEmailList = 'grow_email_list';

    /**
     * Submit-metered, and it depends on nothing. A [[Standalone]] install
     * captures a phone number into the [[Lead]] log like any other capture;
     * WSMS is a [[Destination]], which is optional by definition.
     */
    case GrowSmsList = 'grow_sms_list';

    /**
     * Click-metered, `tier: pro`, and absent outright on a site with no store.
     *
     * The Pro tier is a **correctness fix rather than packaging**: both cart
     * [[Condition]]s are Pro, and ADR 0012 drops a premium Condition on the
     * grounds that dropping only widens the audience. That fails here, because
     * the copy asserts the fact the Condition guaranteed — dropped, *"you left
     * 3 items in your cart"* shows to every visitor on the site. Making the
     * Goal itself Pro is the only option under which that is impossible rather
     * than merely avoided (ADR 0026).
     *
     * It captures nothing: no form, no Lead, no [[Consent Record]], no
     * Destination. Its whole product is a message on the page and a link back
     * to the cart (ADR 0025).
     */
    case RecoverCart = 'recover_cart';

    /** Click-metered, and free. The other Goal with no form (ADR 0025). */
    case PromoteOffer = 'promote_offer';

    /**
     * Submit-metered, and the one Goal whose headline is not `conversion`.
     *
     * The delivery happens *after* the Conversion, from a different process,
     * and can fail on its own — which is why it is its own `kind` rather than
     * something derived, and why `conversions − lead_magnet_delivered` is the
     * delivery failure count with no second metric behind it (ADR 0008,
     * ADR 0020).
     */
    case DeliverLeadMagnet = 'deliver_lead_magnet';

    /**
     * Which countable act this Goal is measured by.
     *
     * Three of the five are submissions and **two convert on a click**, so not
     * every Conversion is a [[Lead]] (CONTEXT.md, Conversion). This is also
     * what a [[Playbook]]'s default [[Template]] is checked against at
     * registration: a Template offering the other act reports nothing for the
     * Goal it was filed under.
     */
    public function convertingAct(): ConvertingAct
    {
        return match ($this) {
            self::RecoverCart, self::PromoteOffer => ConvertingAct::Click,
            default => ConvertingAct::Submit,
        };
    }

    /**
     * The counted kind this Goal's headline number is read from.
     *
     * Read at report time off the Optin's CURRENT Goal, never frozen onto a
     * row: `wconvert_stats` carries no `goal` at all, and everything needed to
     * interpret a count is joined from `wconvert_optins` (ADR 0020). That is
     * what makes correcting a Goal restate the whole history.
     */
    public function headlineKind(): StatKind
    {
        return $this === self::DeliverLeadMagnet ? StatKind::LeadMagnetDelivered : StatKind::Conversion;
    }

    /**
     * Which install supplies this Goal. Only the cart Goal is Pro (ADR 0026).
     */
    public function tier(): Tier
    {
        return $this === self::RecoverCart ? Tier::Pro : Tier::Free;
    }

    /**
     * What the SITE must have for this Goal to mean anything — or null, where
     * it needs nothing but WordPress.
     *
     * Substitution was refused outright: there is no weaker cart Goal, and
     * inventing one hands the merchant an analytics screen reporting
     * cart-recovery clicks on a site with no carts — precisely the
     * countability failure the [[Goal]] test exists to prevent (ADR 0026).
     */
    public function requires(): ?SiteDependency
    {
        return $this === self::RecoverCart ? SiteDependency::WooCommerce : null;
    }

    /**
     * The merchant's own words for it, translated.
     *
     * The labels live in PHP and travel over REST rather than being spelled
     * again in the admin bundle. `wp i18n make-pot` cannot see a JSON string —
     * the same reason bundled [[Playbook]]s ship as PHP arrays (ADR 0013) —
     * and a second spelling in TypeScript would be a fifth cross-language list
     * with nothing asserting the two agree.
     */
    public function label(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Grow my email list', 'wconvert'),
            self::GrowSmsList => __('Grow my SMS list', 'wconvert'),
            self::RecoverCart => __('Bring shoppers back to their cart', 'wconvert'),
            self::PromoteOffer => __('Promote a sale or offer', 'wconvert'),
            self::DeliverLeadMagnet => __('Deliver a lead magnet', 'wconvert'),
        };
    }

    /**
     * What the goal screen says under the label — one line, and it names the
     * number the merchant will be reading afterwards.
     */
    public function description(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Capture email addresses and count every submission.', 'wconvert'),
            self::GrowSmsList => __('Capture phone numbers and count every submission.', 'wconvert'),
            self::RecoverCart => __('Show shoppers with a full cart the way back to it, and count the clicks.', 'wconvert'),
            self::PromoteOffer => __('Send visitors to an offer, and count the clicks through to it.', 'wconvert'),
            self::DeliverLeadMagnet => __('Send a file in exchange for an address, and count the deliveries.', 'wconvert'),
        };
    }
}

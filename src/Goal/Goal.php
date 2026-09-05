<?php

namespace WConvert\Goal;

use WConvert\Stats\StatKind;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;

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
 * a plain `VARCHAR(64)`, and {@see Goal::tryFrom()} is the one place the set is
 * enforced — the same arrangement `StatKind` has over its own column, and for
 * the same reason (adding a case should be a code change a reviewer reads, not
 * a migration).
 *
 * **And the column is unindexed.** This said "with `idx_goal`", which was true
 * of the DDL and false of every query: nothing filters on `goal`. The Optin
 * list orders by the primary key and projects the column, and the per-Goal
 * metrics read it out of `INTERPRETATION_COLUMNS` and group in PHP (ADR 0034).
 * The index was removed in the pre-release audit rather than left to be
 * rediscovered by whoever next wrote a query expecting it to be there.
 *
 * ============================================================================
 * A GOAL DECLARES THE COUNTED **KIND**. IT NEVER DECLARES THE ACT.
 * ============================================================================
 * Which [[Conversion]] is the one that matters, and whether that Conversion is
 * a [[Lead]]. That declaration is applied when the analytics screen is READ,
 * never stamped on each Conversion as it happens, so correcting a mis-set Goal
 * restates the Optin's whole history rather than splitting it at the moment of
 * the edit (ADR 0020). "Kept for its whole life" means persistent, not frozen.
 *
 * **What a Goal used to declare as well was the converting act, and that was a
 * duplicate** (ADR 0059). {@see \WConvert\Template\TemplateLibrary::refuse()}
 * already rejects, at registration, any design offering two acts or none — so
 * a registered design offers exactly one and the design has always been the
 * enforced source of truth. The loader agrees: it has one `convert()` callback
 * reporting one beacon kind, and the word `goal` appears nowhere in
 * `resources/loader/` or `resources/renderer/` at all. A `convertingAct()`
 * here was a second declaration of a fact the design already carried, and
 * every act-shaped refusal in the product existed only because two sources
 * could disagree.
 *
 * So it is gone, and a merchant who opened *Browse designs* to find five of
 * seven popup designs greyed out now finds none of them greyed. What survives
 * is what only a Goal can say: the counted kind, the tier, the site
 * dependency, the words, and the grouping on Analytics.
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
    /** The email a design captures is the [[Lead]]'s identity key. */
    case GrowEmailList = 'grow_email_list';

    /**
     * It depends on nothing. A [[Standalone]] install captures a phone number
     * into the [[Lead]] log like any other capture; WSMS is a [[Destination]],
     * which is optional by definition.
     *
     * **Nothing makes it prefer a design that asks for a phone number**, and
     * nothing should: which detail to ask a visitor for is the merchant's own
     * judgement, and the SMS list a merchant grows from an email capture is
     * still a list they grew (ADR 0059).
     */
    case GrowSmsList = 'grow_sms_list';

    /**
     * `tier: pro`, and absent outright on a site with no store.
     *
     * The Pro tier is a **correctness fix rather than packaging**: both cart
     * [[Condition]]s are Pro, and ADR 0012 drops a premium Condition on the
     * grounds that dropping only widens the audience. That fails here, because
     * the copy asserts the fact the Condition guaranteed — dropped, *"you left
     * 3 items in your cart"* shows to every visitor on the site. Making the
     * Goal itself Pro is the only option under which that is impossible rather
     * than merely avoided (ADR 0026).
     *
     * **ADR 0025's shape is the DESIGN's, not this Goal's** (amended by
     * ADR 0059). Its own Playbooks all name a one-step, click-metered design
     * with no form on it, and that design captures nothing, writes no Lead,
     * snapshots no [[Consent Record]] and holds no Destination. What is no
     * longer refused is the merchant who wants *"enter your email and we'll
     * save your cart"* — the case ADR 0025 explicitly wanted routed somewhere
     * — under this Goal with a capturing design. It now just works, and the
     * cart CTA stays keyed on the Goal because a design with no link button
     * has nothing for it to resolve into.
     */
    case RecoverCart = 'recover_cart';

    /** Free, and the Goal whose bundled [[Playbook]]s link away (ADR 0025). */
    case PromoteOffer = 'promote_offer';

    /**
     * The one Goal whose headline is not `conversion`, and therefore the one
     * that needs its design to capture something ({@see self::needsACapture()}).
     *
     * The delivery happens *after* the Conversion, from a different process,
     * and can fail on its own — which is why it is its own `kind` rather than
     * something derived, and why `conversions − lead_magnet_delivered` is the
     * delivery failure count with no second metric behind it (ADR 0008,
     * ADR 0020).
     */
    case DeliverLeadMagnet = 'deliver_lead_magnet';

    /**
     * Whether this Goal's product is a captured contact.
     *
     * ========================================================================
     * THE SECOND THING A DESIGN CANNOT ANSWER, AND THE TEST IT PASSES.
     * ========================================================================
     * ADR 0059 deleted `convertingAct()` because a registered design already
     * declared the act and the Goal was a second voice. The test it applied is
     * the one that matters here: **is this fact derivable from the design?**
     * The act is; this is not. Two designs can be byte-identical and serve a
     * Goal that wants a list and one that wants a click-through, and nothing
     * in a tree says which.
     *
     * **It exists because that ticket made a new mistake reachable.** A Goal
     * that counts submissions used to refuse every design offering the other
     * act, so *"grow my email list"* over a design with no field on it was
     * impossible. It is now allowed, and it is silent: the Optin saves, runs,
     * counts click-throughs, and collects nothing. The merchant finds out when
     * no [[Lead]]s arrive. So the builder's Summary says so
     * ({@see \WConvert\Rest\GoalRegistry} carries it to the admin as
     * `grows_a_list`).
     *
     * **A note and never a refusal**, which is the whole difference from
     * {@see self::needsACapture()} below. The Optin is not broken — a
     * click-through is a real Conversion and the number is honest — it is
     * merely not the thing the merchant said they wanted. And it is not a
     * gallery filter either: pre-pressing a captures chip for a Goal is a Goal
     * facet in a captures chip's clothes, which ADR 0043 forbids.
     *
     * **Which detail it should ask for stays unanswered here.** Email against
     * phone is the merchant's own judgement, and an SMS list grown from an
     * email capture is still a list they grew — so this asks whether the
     * design captures ANYTHING, never what.
     */
    public function growsAList(): bool
    {
        return $this !== self::RecoverCart && $this !== self::PromoteOffer;
    }

    /**
     * Whether this Goal's own number is unreachable on a design that captures
     * nothing.
     *
     * ========================================================================
     * NAMED FOR WHY, NOT FOR WHICH CASE.
     * ========================================================================
     * The delivery kind is written by {@see
     * \WConvert\Destination\LeadMagnet\DeliveryCount} when a push to the
     * lead-magnet Destination succeeds, and there is nothing to push to unless
     * the visitor gave an address. So a Goal reading its headline from that
     * kind over a design with no `field` in it reports **zero forever** —
     * ADR 0020's failure that looks broken while being right — and that is a
     * refusal rather than a note.
     *
     * **This is the ONE surviving Goal-shaped refusal about a design**
     * (ADR 0059), and it is deliberately not a filter: pre-pressing a captures
     * chip in the gallery would be a Goal facet in a captures chip's clothes,
     * which ADR 0043 forbids. It is derived rather than listed per case, so a
     * sixth Goal reading the delivery kind arrives already answered.
     *
     * **It is the strict half of {@see self::growsAList()} above**, and the
     * two are ordered rather than parallel: everything that needs a capture
     * grows a list, and `GoalRegistryTest` asserts that implication so the
     * pair cannot drift into contradicting each other. What separates them is
     * the consequence — this one refuses the save, because the headline number
     * is literally unreachable; that one prints a sentence, because the number
     * is fine and merely measures something else.
     */
    public function needsACapture(): bool
    {
        return $this->headlineKind() === StatKind::LeadMagnetDelivered;
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
     * What the headline number is CALLED, on the card that reports it.
     *
     * ========================================================================
     * IT IS THE KIND'S WORD NOW, AND THE FIVE-WAY `match` HAS RETIRED.
     * ========================================================================
     * This said *"Submissions"*, *"Click-throughs back to the cart"* and
     * *"Click-throughs to the offer"* — five wordings over five Goals — and it
     * could, because a Goal declared the converting act. It no longer does
     * (ADR 0059), so a card grouping every Optin under one Goal can hold one
     * that submits beside one that links away, and a card headed
     * *"Submissions"* over a click-metered Optin's number would be reporting
     * the thing it exists not to report.
     *
     * **"Conversions" is right for every mix**, and it is what the row already
     * says: `wconvert_stats` stores `kind = conversion` whichever act
     * produced it, so the number was never act-specific and only the word was.
     * It is also what OptinMonster's own glossary does — one word covering
     * *"submitting their email address … or clicking on a button to be
     * redirected"*.
     *
     * **The precise word survives where it is still precise.** The builder's
     * per-Optin strip says *"Submissions"* or *"Click-throughs"*, derived from
     * the one design that Optin holds — which is always right, because it
     * reads the same tree the renderer does.
     *
     * Still in PHP with the rest of the labels, and for the same reason:
     * `wp i18n make-pot` cannot see a JavaScript string, and a second spelling
     * in the admin bundle is what `tests/unit/Goal/GoalParityTest.php` fails
     * on.
     */
    public function headlineLabel(): string
    {
        return $this->headlineKind()->label();
    }

    /**
     * Which install supplies this Goal. Only the cart Goal is paid (ADR 0026).
     *
     * **`Elite`, and it is a real rung rather than a synonym for "premium"**
     * (ADR 0056). It rides with the two cart [[Condition]]s, which are declared
     * at the same tier in the rule manifest — and that is not a coincidence to
     * be kept by hand: the Goal's copy ASSERTS what those Conditions guarantee,
     * so an install that supplied the Goal without them would ship a popup
     * saying *"you left 3 items in your cart"* to every visitor on the site.
     * The tier is what makes the two arrive together.
     *
     * At launch every paid tier displays as "Pro", so this reads to a merchant
     * exactly as it did before the ladder existed.
     */
    public function tier(): Tier
    {
        return $this === self::RecoverCart ? Tier::Elite : Tier::Free;
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

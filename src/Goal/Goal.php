<?php

namespace WConvert\Goal;

use WConvert\Stats\StatKind;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/** Closed business intents. OutcomeContract owns the publish requirements and proof. */
enum Goal: string
{

    public function outcome(): OutcomeContract
    {
        return match ($this) {
            self::GrowEmailList => new OutcomeContract('submit', ['email'],
                __('Use a form with a required email field.', 'wconvert'),
                __('Counts submissions with an email address. Subscription and confirmation are not measured.', 'wconvert'), 'captured', audienceChannel: 'email'),
            self::GrowSmsList => new OutcomeContract('submit', ['phone'],
                __('Use a form with a required phone field.', 'wconvert'),
                __('Counts submissions with a phone number. Subscription and confirmation are not measured.', 'wconvert'), 'captured', audienceChannel: 'phone'),
            self::CollectEnquiries => new OutcomeContract('submit', ['email', 'phone'],
                __('Use an enquiry form with an email or phone field.', 'wconvert'),
                __('Counts enquiries submitted here. Replies, bookings and completed work are not measured.', 'wconvert'), 'captured'),
            self::FindMatch => new OutcomeContract('match', [],
                __('Use a Result screen and questions that lead to it.', 'wconvert'),
                __('Counts quiz results shown. Product clicks and purchases are separate.', 'wconvert'), 'quiz_completed'),
            self::IncreaseBasketValue => new OutcomeContract('add_to_cart', [],
                __('Use product recommendations with Add to cart.', 'wconvert'),
                __('Counts appearances with a WooCommerce-confirmed addition. Product clicks and purchases are separate.', 'wconvert'), 'basket_added'),
            self::RecoverCart => new OutcomeContract('click', [],
                __('Use a design whose button links to the cart.', 'wconvert'),
                __('Counts clicks back to the cart, not completed orders or recovered revenue.', 'wconvert'), 'on_site_action'),
            self::PromoteOffer => new OutcomeContract('click', [],
                __('Use a design whose button links to your offer or content.', 'wconvert'),
                __('Counts clicks to your offer or content, not later purchases or bookings.', 'wconvert'), 'on_site_action', linkRequired: true),
            // Nothing to convert on: a message is shown and its appearances are the whole report (ADR 0163).
            self::ShowMessage => new OutcomeContract('none', [],
                __('Remove the form and any counted button, or choose Promote an offer.', 'wconvert'),
                __('Counts appearances only, so a message has no conversion rate.', 'wconvert'), 'shown'),
            self::DeliverLeadMagnet => new OutcomeContract('submit', ['email'],
                __('Use a required email field and connect a lead magnet email destination.', 'wconvert'),
                __('Counts lead magnet emails your mail service accepted, not inbox arrival or downloads. Resends can count again.', 'wconvert'),
                'handoff_accepted', 'lead_magnet_email'),
        };
    }

    case GrowEmailList = 'grow_email_list';

    case GrowSmsList = 'grow_sms_list';

    case IncreaseBasketValue = 'increase_basket_value';

    case RecoverCart = 'recover_cart';

    case PromoteOffer = 'promote_offer';

    case ShowMessage = 'show_message';

    case DeliverLeadMagnet = 'deliver_lead_magnet';

    case CollectEnquiries = 'collect_enquiries';

    case FindMatch = 'find_match';

    public function headlineKind(): StatKind
    {
        return match ($this) {
            self::DeliverLeadMagnet => StatKind::LeadMagnetDelivered,
            self::ShowMessage => StatKind::Impression,
            default => StatKind::Conversion,
        };
    }

    public function headlineLabel(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Email submissions', 'wconvert'),
            self::GrowSmsList => __('Phone submissions', 'wconvert'),
            self::CollectEnquiries => __('Enquiries captured', 'wconvert'),
            self::FindMatch => __('Quiz completions', 'wconvert'),
            self::IncreaseBasketValue => __('Basket additions', 'wconvert'),
            self::RecoverCart => __('Cart return clicks', 'wconvert'),
            self::PromoteOffer => __('Link clicks', 'wconvert'),
            self::ShowMessage => __('Appearances', 'wconvert'),
            self::DeliverLeadMagnet => __('Emails accepted for sending', 'wconvert'),
        };
    }

    public function rateLabel(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Email submission rate', 'wconvert'),
            self::GrowSmsList => __('Phone submission rate', 'wconvert'),
            self::CollectEnquiries => __('Enquiry rate', 'wconvert'),
            self::FindMatch => __('Quiz completion rate', 'wconvert'),
            self::IncreaseBasketValue => __('Basket addition rate', 'wconvert'),
            self::RecoverCart => __('Cart return click rate', 'wconvert'),
            self::PromoteOffer => __('Link click rate', 'wconvert'),
            self::ShowMessage => __('Not counted', 'wconvert'),
            self::DeliverLeadMagnet => __('Resource request rate', 'wconvert'),
        };
    }

    public function tier(): Tier
    {
        return match ($this) { self::RecoverCart, self::IncreaseBasketValue, self::FindMatch => Tier::Pro, default => Tier::Free };
    }

    public function requires(): ?SiteDependency
    {
        return in_array($this, [self::RecoverCart, self::IncreaseBasketValue], true) ? SiteDependency::WooCommerce : null;
    }

    public function label(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Grow my email list', 'wconvert'),
            self::GrowSmsList => __('Grow my SMS list', 'wconvert'),
            self::IncreaseBasketValue => __('Increase basket value', 'wconvert'),
            self::RecoverCart => __('Bring shoppers back to their cart', 'wconvert'),
            self::PromoteOffer => __('Promote an offer or content', 'wconvert'),
            self::ShowMessage => __('Show a message', 'wconvert'),
            self::DeliverLeadMagnet => __('Deliver a lead magnet', 'wconvert'),
            self::CollectEnquiries => __('Collect enquiries', 'wconvert'),
            self::FindMatch => __('Help visitors find a match', 'wconvert'),
        };
    }

    public function description(): string
    {
        return match ($this) {
            // Outcome words; what is counted is the setup's "Counts" line and Analytics' job.
            self::GrowEmailList => __('Collect email addresses for your newsletter or offers.', 'wconvert'),
            self::GrowSmsList => __('Collect phone numbers for text messages.', 'wconvert'),
            self::IncreaseBasketValue => __('Suggest useful extras while shoppers fill their cart.', 'wconvert'),
            self::RecoverCart => __('Bring shoppers with a full cart back to checkout.', 'wconvert'),
            self::PromoteOffer => __('Send visitors to a sale, an offer or a useful page.', 'wconvert'),
            self::ShowMessage => __('Tell visitors something, like free shipping or opening hours.', 'wconvert'),
            self::DeliverLeadMagnet => __('Send a guide, file or checklist in exchange for an email.', 'wconvert'),
            self::CollectEnquiries => __('Take questions and quote requests from visitors.', 'wconvert'),
            self::FindMatch => __('Ask a few questions and suggest the right product or page.', 'wconvert'),
        };
    }
}

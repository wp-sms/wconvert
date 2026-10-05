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
                __('Use a form with a required email field before publishing.', 'wconvert'),
                __('Counts submitted forms with an email address. Subscription and confirmation are managed by your email service and are not measured here.', 'wconvert'), 'captured', audienceChannel: 'email'),
            self::GrowSmsList => new OutcomeContract('submit', ['phone'],
                __('Use a form with a required phone field before publishing.', 'wconvert'),
                __('Counts submitted forms with a phone number. Subscription and confirmation are managed by your SMS service and are not measured here.', 'wconvert'), 'captured', audienceChannel: 'phone'),
            self::CollectEnquiries => new OutcomeContract('submit', ['email', 'phone'],
                __('Use an enquiry form with an email or phone field before publishing.', 'wconvert'),
                __('Counts enquiries submitted here. Replies, bookings and completed work in another service are not measured.', 'wconvert'), 'captured'),
            self::FindMatch => new OutcomeContract('match', [],
                __('Use a journey with a Results screen and a valid question path.', 'wconvert'),
                __('Counts quiz results shown. Product clicks and purchases are separate.', 'wconvert'), 'quiz_completed'),
            self::IncreaseBasketValue => new OutcomeContract('add_to_cart', [],
                __('Use product recommendations with Add to cart before publishing.', 'wconvert'),
                __('Counts campaign appearances with at least one WooCommerce-confirmed addition. Product clicks and purchases are separate.', 'wconvert'), 'basket_added'),
            self::RecoverCart => new OutcomeContract('click', [],
                __('Use a design whose button links to the cart before publishing.', 'wconvert'),
                __('Counts clicks back to the cart. Completed orders and recovered revenue are not measured.', 'wconvert'), 'on_site_action'),
            self::PromoteOffer => new OutcomeContract('click', [],
                __('Use a design whose button links to your offer or content before publishing.', 'wconvert'),
                __('Counts clicks to your linked offer or content. Purchases and bookings after that click are not measured.', 'wconvert'), 'on_site_action', linkRequired: true),
            self::DeliverLeadMagnet => new OutcomeContract('submit', ['email'],
                __('Use a form with a required email field and connect a lead magnet email destination before publishing.', 'wconvert'),
                __('Counts lead magnet emails accepted by the site’s mail service. Inbox arrival and file downloads are not measured. Resends can count again.', 'wconvert'),
                'handoff_accepted', 'lead_magnet_email'),
        };
    }

    case GrowEmailList = 'grow_email_list';

    case GrowSmsList = 'grow_sms_list';

    case IncreaseBasketValue = 'increase_basket_value';

    case RecoverCart = 'recover_cart';

    case PromoteOffer = 'promote_offer';

    case DeliverLeadMagnet = 'deliver_lead_magnet';

    case CollectEnquiries = 'collect_enquiries';

    case FindMatch = 'find_match';

    public function headlineKind(): StatKind
    {
        return $this === self::DeliverLeadMagnet ? StatKind::LeadMagnetDelivered : StatKind::Conversion;
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
            self::DeliverLeadMagnet => __('Resource request rate', 'wconvert'),
        };
    }

    public function tier(): Tier
    {
        return match ($this) { self::RecoverCart, self::IncreaseBasketValue => Tier::Elite, self::FindMatch => Tier::Basic, default => Tier::Free };
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
            self::DeliverLeadMagnet => __('Deliver a lead magnet', 'wconvert'),
            self::CollectEnquiries => __('Collect enquiries', 'wconvert'),
            self::FindMatch => __('Help visitors find a match', 'wconvert'),
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Capture email addresses and count every submission.', 'wconvert'),
            self::GrowSmsList => __('Capture phone numbers and count every submission.', 'wconvert'),
            self::IncreaseBasketValue => __('Recommend useful extras and count confirmed additions to the basket.', 'wconvert'),
            self::RecoverCart => __('Show shoppers with a full cart the way back to it, and count the clicks.', 'wconvert'),
            self::PromoteOffer => __('Send visitors to an offer or a useful page, and count the clicks through to it.', 'wconvert'),
            self::DeliverLeadMagnet => __('Email a resource link and count emails accepted for sending.', 'wconvert'),
            self::CollectEnquiries => __('Capture requests with contact details for follow-up in Leads or your connected service.', 'wconvert'),
            self::FindMatch => __('Ask a few questions and show one relevant result, with signup optional.', 'wconvert'),
        };
    }
}

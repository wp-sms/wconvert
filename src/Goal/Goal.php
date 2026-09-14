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

    case RecoverCart = 'recover_cart';

    case PromoteOffer = 'promote_offer';

    case DeliverLeadMagnet = 'deliver_lead_magnet';

    case CollectEnquiries = 'collect_enquiries';

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
            self::RecoverCart => __('Cart return clicks', 'wconvert'),
            self::PromoteOffer => __('Link clicks', 'wconvert'),
            self::DeliverLeadMagnet => __('Emails accepted for sending', 'wconvert'),
        };
    }

    public function tier(): Tier
    {
        return $this === self::RecoverCart ? Tier::Elite : Tier::Free;
    }

    public function requires(): ?SiteDependency
    {
        return $this === self::RecoverCart ? SiteDependency::WooCommerce : null;
    }

    public function label(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Grow my email list', 'wconvert'),
            self::GrowSmsList => __('Grow my SMS list', 'wconvert'),
            self::RecoverCart => __('Bring shoppers back to their cart', 'wconvert'),
            self::PromoteOffer => __('Promote an offer or content', 'wconvert'),
            self::DeliverLeadMagnet => __('Deliver a lead magnet', 'wconvert'),
            self::CollectEnquiries => __('Collect enquiries', 'wconvert'),
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::GrowEmailList => __('Capture email addresses and count every submission.', 'wconvert'),
            self::GrowSmsList => __('Capture phone numbers and count every submission.', 'wconvert'),
            self::RecoverCart => __('Show shoppers with a full cart the way back to it, and count the clicks.', 'wconvert'),
            self::PromoteOffer => __('Send visitors to an offer or a useful page, and count the clicks through to it.', 'wconvert'),
            self::DeliverLeadMagnet => __('Email a resource link and count emails accepted for sending.', 'wconvert'),
            self::CollectEnquiries => __('Capture requests with contact details for follow-up in Leads or your connected service.', 'wconvert'),
        };
    }
}

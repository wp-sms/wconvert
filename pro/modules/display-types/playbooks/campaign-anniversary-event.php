<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-anniversary-event',
    'name' => __('Anniversary Event', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-anniversary-event',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('ANNIVERSARY PROMOTION', 'wconvert-pro'), 'headline' => __('OUR BIRTHDAY.
YOUR 20% OFF.', 'wconvert-pro'), 'body' => [['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('20% OFF', 'wconvert-pro')], ['text' => __('Celebrate with 20% off selected favorites.', 'wconvert-pro')]], 'cta_label' => __('Shop the event', 'wconvert-pro'), 'fine_print' => ['text' => __('Selected items. Anniversary promotion; exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

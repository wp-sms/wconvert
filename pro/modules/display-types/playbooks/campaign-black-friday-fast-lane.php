<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-black-friday-fast-lane',
    'name' => __('Black Friday Fast Lane', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-black-friday-fast-lane',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Set a real campaign end date for the countdown.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / SCHEDULED SALE DEADLINE', 'wconvert-pro'), 'headline' => __('40% OFF.
ENDS NOV 30.', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hours', 'wconvert-pro'), 'minutes_label' => __('Minutes', 'wconvert-pro'), 'seconds_label' => __('Seconds', 'wconvert-pro')], 'cta_label' => __('Shop Black Friday', 'wconvert-pro'), 'fine_print' => ['text' => __('November 27–30. Selected items. Ends at 23:59 UTC.', 'wconvert-pro')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-black-friday-fast-lane',
    'name' => __('Black Friday Fast Lane', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-black-friday-fast-lane',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Set a real campaign end date for the countdown.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / SELECTED ITEMS', 'wconvert-pro'), 'headline' => __('40% OFF.
ENDS NOV 30.', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('DAYS', 'wconvert-pro'), 'hours_label' => __('HRS', 'wconvert-pro'), 'minutes_label' => __('MIN', 'wconvert-pro'), 'seconds_label' => __('Seconds', 'wconvert-pro')], 'cta_label' => __('Shop before the close', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

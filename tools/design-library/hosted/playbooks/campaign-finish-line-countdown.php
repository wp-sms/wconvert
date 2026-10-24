<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-finish-line-countdown',
    'name' => __('Finish-Line Countdown', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-finish-line-countdown',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Set a real campaign end date for the countdown.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / SCHEDULED SPORTSWEAR SALE', 'wconvert'), __('TIME LEFT', 'wconvert')], 'headline' => [__('BIG DEALS.', 'wconvert'), __('UP TO 40% OFF.', 'wconvert')], 'body' => [['text' => __('Up to 40% off selected training gear.', 'wconvert')], ['text' => __('ENDS NOV 30
23:59 UTC', 'wconvert')]], 'cta_label' => __('Shop before the finish', 'wconvert'), 'countdown_units' => ['days_label' => __('DAYS', 'wconvert'), 'hours_label' => __('HRS', 'wconvert'), 'minutes_label' => __('MIN', 'wconvert'), 'seconds_label' => __('Seconds', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

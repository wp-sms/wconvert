<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-finish-line-countdown',
    'name' => __('Finish-Line Countdown', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-finish-line-countdown',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Set a real campaign end date for the countdown.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / SCHEDULED SPORTSWEAR SALE', 'wconvert'), __('TIME LEFT', 'wconvert')], 'headline' => __('BIG DEALS.
UP TO 40% OFF.', 'wconvert'), 'body' => [['text' => __('Up to 40% off selected training gear.', 'wconvert')], ['text' => __('ENDS NOVEMBER 30', 'wconvert')]], 'cta_label' => __('Shop the final hours', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')], 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hours', 'wconvert'), 'minutes_label' => __('Minutes', 'wconvert'), 'seconds_label' => __('Seconds', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

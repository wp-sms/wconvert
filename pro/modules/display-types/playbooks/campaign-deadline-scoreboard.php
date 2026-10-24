<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-deadline-scoreboard',
    'name' => __('Deadline Scoreboard', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-deadline-scoreboard',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Set a real campaign end date for the countdown.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / SALE DEADLINE REMINDER', 'wconvert-pro'), __('ENDS NOVEMBER 30', 'wconvert-pro')], 'headline' => __('UP TO 40% OFF.', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hours', 'wconvert-pro'), 'minutes_label' => __('Minutes', 'wconvert-pro'), 'seconds_label' => __('Seconds', 'wconvert-pro')], 'body' => ['text' => __('23:59 UTC', 'wconvert-pro')], 'cta_label' => __('Shop before it ends', 'wconvert-pro'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

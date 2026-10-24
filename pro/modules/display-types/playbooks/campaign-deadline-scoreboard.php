<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-deadline-scoreboard',
    'name' => __('Deadline Scoreboard', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-deadline-scoreboard',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule. Set a real campaign end date for the countdown.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / NOV 27—30', 'wconvert-pro'), __('THE CLOCK IS ON.', 'wconvert-pro')], 'headline' => __('UP TO 40% OFF.', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('DAYS', 'wconvert-pro'), 'hours_label' => __('HRS', 'wconvert-pro'), 'minutes_label' => __('MIN', 'wconvert-pro'), 'seconds_label' => __('Seconds', 'wconvert-pro')], 'body' => ['text' => __('ENDS NOVEMBER 30
23:59 UTC', 'wconvert-pro')], 'cta_label' => __('Shop the event', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

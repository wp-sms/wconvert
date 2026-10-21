<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'halloween-sale-countdown',
    'name' => __('Halloween sale countdown', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'halloween-countdown',
    'notes' => __('Keep a Halloween sale visible in a compact bar. Replace the sample discount, choose the shop link and set the genuine campaign end date and time. The countdown uses that same deadline.', 'wconvert'),
    'copy' => [
        'badge' => __('HALLOWEEN', 'wconvert'),
        'headline' => __('31% off sitewide', 'wconvert'),
        'body' => __('A little Halloween magic', 'wconvert'),
        'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')],
        'cta_label' => __('Shop now', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'halloween-sale-countdown',
    'name' => __('Halloween sale countdown', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'halloween-countdown',
    'notes' => __('Keep a Halloween sale visible in a compact bar. Replace the sample discount, choose the shop link and set the genuine campaign end date and time. The countdown uses that same deadline.', 'wconvert-pro'),
    'copy' => [
        'badge' => __('HALLOWEEN', 'wconvert-pro'),
        'headline' => __('31% off sitewide', 'wconvert-pro'),
        'body' => __('A little Halloween magic', 'wconvert-pro'),
        'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')],
        'cta_label' => __('Shop now', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

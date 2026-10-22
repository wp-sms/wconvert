<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-night-shift',
    'name' => __('The night shift', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-night-shift',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('CYBER MONDAY / FINAL HOURS', 'wconvert'),
        'headline' => __('One last bright idea. 30% off.', 'wconvert'),
        'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')],
        'cta_label' => __('Shop the night shift', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

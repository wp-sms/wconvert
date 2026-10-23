<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-weekend-curtain',
    'name' => __('The weekend curtain', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-weekend-curtain',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('BLACK FRIDAY / THE LAST CALL', 'wconvert-pro'), __('OFFER ENDS IN', 'wconvert-pro')],
        'headline' => __('Before the curtain falls. 30% off.', 'wconvert-pro'),
        'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')],
        'cta_label' => __('Shop the final edit', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

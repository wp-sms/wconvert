<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-weekend-curtain',
    'name' => __('The weekend curtain', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-weekend-curtain',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('BLACK FRIDAY / THE LAST CALL', 'wconvert'), __('OFFER ENDS IN', 'wconvert')],
        'headline' => __('Before the curtain falls. 30% off.', 'wconvert'),
        'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')],
        'cta_label' => __('Shop the final edit', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

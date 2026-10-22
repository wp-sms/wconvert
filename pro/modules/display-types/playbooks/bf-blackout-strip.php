<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-blackout-strip',
    'name' => __('The blackout strip', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-blackout-strip',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('BLACK FRIDAY', 'wconvert'),
        'headline' => __('The blackout. 30% off.', 'wconvert'),
        'cta_label' => __('Shop the drop', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

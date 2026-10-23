<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-little-black-gift',
    'name' => __('A little black gift', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-little-black-gift',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('A BLACK FRIDAY LITTLE SOMETHING', 'wconvert-pro'),
        'headline' => __('Good things.
Small packages.', 'wconvert-pro'),
        'body' => __('Unwrap 25% off your next good find.', 'wconvert-pro'),
        'cta_label' => __('Unwrap the offer', 'wconvert-pro'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-midnight-atelier',
    'name' => __('Midnight atelier', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-midnight-atelier',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('THE BLACK FRIDAY EDIT', 'wconvert-pro'),
        'headline' => [__('Good things.
Better prices.', 'wconvert-pro'), __('30%', 'wconvert-pro')],
        'body' => [__('Considered pieces. An exceptional weekend.', 'wconvert-pro'), __('OFF
THE EDIT', 'wconvert-pro')],
        'cta_label' => __('Explore the edit', 'wconvert-pro'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

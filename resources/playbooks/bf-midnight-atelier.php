<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-midnight-atelier',
    'name' => __('Midnight atelier', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-midnight-atelier',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('THE BLACK FRIDAY EDIT', 'wconvert'),
        'headline' => [__('Good things.
Better prices.', 'wconvert'), __('30%', 'wconvert')],
        'body' => [__('Considered pieces. An exceptional weekend.', 'wconvert'), __('OFF
THE EDIT', 'wconvert')],
        'cta_label' => __('Explore the edit', 'wconvert'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

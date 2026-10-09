<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'product-finder',
    'name' => __('Help shoppers choose garden products', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'journey-product-finder',
    'notes' => __('Select WooCommerce products for every result and review fallback links. Garden visitors see a sun question; balcony visitors skip it. Test each route.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:need' => [
                'headline' => __('Find the right products', 'wconvert'),
                'body' => __('Two quick questions help us recommend the right products.', 'wconvert'),
                'next_label' => __('Continue', 'wconvert'),
            ],
            'screen:garden' => [
                'headline' => __('Tell us about your garden', 'wconvert'),
                'next_label' => __('Continue', 'wconvert'),
                'back_label' => __('Back', 'wconvert'),
            ],
            'screen:match' => [
                'back_label' => __('Back', 'wconvert'),
            ],
        ],
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 15,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];

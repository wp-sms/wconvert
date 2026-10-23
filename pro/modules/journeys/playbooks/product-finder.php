<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'product-finder',
    'name' => __('Help shoppers choose garden products', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'journey-product-finder',
    'notes' => __('Select WooCommerce products for every result and review fallback links. Garden visitors see a sun question; balcony visitors skip it. Test each route.', 'wconvert-pro'),
    'copy' => [
        'screens' => [
            'screen:need' => [
                'headline' => __('Find the right products', 'wconvert-pro'),
                'body' => __('Two quick questions help us recommend the right products.', 'wconvert-pro'),
                'next_label' => __('Continue', 'wconvert-pro'),
            ],
            'screen:garden' => [
                'headline' => __('Tell us about your garden', 'wconvert-pro'),
                'next_label' => __('Continue', 'wconvert-pro'),
                'back_label' => __('Back', 'wconvert-pro'),
            ],
            'screen:match' => [
                'back_label' => __('Back', 'wconvert-pro'),
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

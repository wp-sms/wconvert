<?php

defined('ABSPATH') || exit;

return [
    'id' => 'product-finder',
    'name' => __('Help shoppers find a product', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'journey-product-finder',
    'notes' => __('Ask two quick questions, then select WooCommerce products for each result. Visitors see their result without signing up. Choose products and review the fallback before publishing.', 'wconvert'),
    'copy' => ['screens' => [
        'screen:need' => [
            'headline' => __('Find the right products', 'wconvert'),
            'body' => ['text' => __('Two quick questions help us recommend the right products.', 'wconvert')],
            'next_label' => __('Continue', 'wconvert'),
        ],
        'screen:garden' => [
            'headline' => __('Tell us about your garden', 'wconvert'),
            'next_label' => __('Continue', 'wconvert'),
            'back_label' => __('Back', 'wconvert'),
        ],
        'screen:match' => ['back_label' => __('Back', 'wconvert')],
    ]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

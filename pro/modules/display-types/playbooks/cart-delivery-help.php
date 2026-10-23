<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cart-delivery-help',
    'name' => __('Return to the basket with delivery guidance', 'wconvert-pro'),
    'goal' => 'recover_cart',
    'template_id' => 'inline-cart-nudge',
    'notes' => __('Requires WooCommerce and Pro cart rules. Place on store browsing pages, exclude checkout and verify the delivery calculation matches this wording. This is a static reminder, not a shipping progress bar.', 'wconvert-pro'),
    'copy' => [
        'headline' => __('Check delivery before you decide', 'wconvert-pro'),
        'body' => __('Review your basket, then enter your delivery address at checkout to see the available options.', 'wconvert-pro'),
        'cta_label' => __('Review my basket', 'wconvert-pro'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ], [
            'type' => 'cart_has_items',
        ]],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cart-delivery-help',
    'name' => __('Return to the basket with delivery guidance', 'wconvert'),
    'goal' => 'recover_cart',
    'template_id' => 'inline-cart-nudge',
    'notes' => __('Requires WooCommerce and Pro cart rules. Place on store browsing pages, exclude checkout and verify the delivery calculation matches this wording. This is a static reminder, not a shipping progress bar.', 'wconvert'),
    'copy' => [
        'headline' => __('Check delivery before you decide', 'wconvert'),
        'body' => __('Review your basket, then enter your delivery address at checkout to see the available options.', 'wconvert'),
        'cta_label' => __('Review my basket', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ], [
            'type' => 'cart_has_items',
        ]],
];

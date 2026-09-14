<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'cart-straight-away',
    'name' => __('Inline cart reminder', 'wconvert'),
    'goal' => 'recover_cart',
    'template_id' => 'inline-cta',
    'notes' => __('Place the WConvert block or shortcode where returning shoppers browse. It appears in the page only when the cart has items, with no popup or email capture. Requires WooCommerce and Pro cart rules. The button uses the store cart URL unless you set an override. Check placement and targeting on your shop pages.', 'wconvert'),
    'copy' => [
        'headline' => __('Pick up where you left off', 'wconvert'),
        'body' => __('Your cart is still here when you are ready to take another look.', 'wconvert'),
        'cta_label' => __('Return to my cart', 'wconvert'),
        'fine_print' => __('Items are not reserved. Prices and availability can change.', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'page_load',
        ],
        [
            'type' => 'cart_has_items',
        ],
    ],
];

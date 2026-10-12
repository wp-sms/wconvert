<?php
defined('ABSPATH') || exit;
return [
    'id' => 'basket-cross-sells',
    'name' => __('Offer relevant basket extras', 'wconvert'),
    'business_types' => ['stores'],
    'goal' => 'increase_basket_value',
    'template_id' => 'basket-companion',
    'notes' => __('Set cross-sells on your WooCommerce products, then place this beside the basket. Only eligible products appear; an empty set stays hidden. Test sold-out and already-in-basket items. Counts confirmed additions, not orders.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Before you check out', 'wconvert'),
        'headline' => __('One more useful thing?', 'wconvert'),
        'body' => __('Optional extras for the items in your basket.', 'wconvert'),
    ],
    'rules' => [['type' => 'cart_has_items'], ['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

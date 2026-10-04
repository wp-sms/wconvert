<?php

defined('ABSPATH') || exit;
return [
    'id' => 'recommend-accessory',
    'name' => __('Recommend a compatible accessory', 'wconvert'),
    'business_types' => ['stores'],
    'goal' => 'promote_offer',
    'template_id' => 'cart-accessories',
    'notes' => __('Choose compatible products, add a cart product or category filter, and place this block near the basket. Counts product clicks.', 'wconvert'),
    'copy' => ['eyebrow' => __('A useful addition', 'wconvert'), 'headline' => __('Complete your setup', 'wconvert'), 'body' => __('Take a closer look at these accessories.', 'wconvert')],
    'rules' => [['type' => 'cart_has_items'], ['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;
return [
    'id' => 'shopping-guidance',
    'name' => __('Help with a shopping question', 'wconvert-pro'),
    'business_types' => ['stores'],
    'goal' => 'promote_offer',
    'template_id' => 'inline-cart-nudge',
    'notes' => __('Link to useful sizing, delivery or compatibility guidance. Add a cart product or category filter and place it beside the basket. Counts guide clicks.', 'wconvert-pro'),
    'copy' => ['headline' => __('A little help before you choose', 'wconvert-pro'), 'body' => __('Review the details that matter for your order.', 'wconvert-pro'), 'cta_label' => __('Read the guide', 'wconvert-pro')],
    'rules' => [['type' => 'cart_has_items'], ['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

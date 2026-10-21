<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'finish-the-set',
    'name' => __('Finish the set on a product page', 'wconvert'),
    'goal' => 'increase_basket_value',
    'template_id' => 'product-trio',
    'business_types' => ['stores'],
    'notes' => __('Shows on one product\'s page: choose that main product and up to three items that go with it. For another product, make a copy of the campaign. Each item has an add-to-basket button, and items already in the basket stay hidden. Counts confirmed additions, not orders.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Goes well with it', 'wconvert'),
        'headline' => __('Finish the set.', 'wconvert'),
        'body' => __('Three pieces picked to go with this one.
Add any of them from here.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 20],
    ],
    'targeting' => ['include' => [['type' => 'singular', 'value' => 'product']]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

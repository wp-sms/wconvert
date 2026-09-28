<?php

defined('ABSPATH') || exit;

return [
    'id' => 'new-arrivals-link',
    'name' => __('Introduce new arrivals without a discount', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'photo-offer',
    'business_types' => ['stores'],
    'notes' => __('Link to the current collection. Use relevant product imagery and remove the campaign when the collection changes.', 'wconvert'),
    'copy' => [
        'headline' => __('Made for the everyday.', 'wconvert'),
        'body' => __('Explore the latest pieces, with materials, dimensions and care details on each product page.', 'wconvert'),
        'cta_label' => __('Explore new arrivals', 'wconvert'),
        'fine_print' => __('Browse the collection at your own pace.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'launch-index',
    'name' => __('Introduce a new morning collection', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'launch-index',
    'business_types' => ['stores'],
    'notes' => __('Use only when the collection is available and its destination works. Replace the sample range description, link to the collection and end or revise the announcement when it is no longer new. Keep the bar dismissible and off checkout.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('New collection', 'wconvert-pro'),
        'headline' => __('A slower morning.', 'wconvert-pro'),
        'body' => __('New cups and trays.', 'wconvert-pro'),
        'cta_label' => __('Explore the collection', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 8]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

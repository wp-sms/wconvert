<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fullscreen-announcement',
    'name' => __('Present a collection in fullscreen', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'fullscreen-poster',
    'notes' => __('Give visitors time to read before presenting the collection. Replace the example link, review page targeting and frequency, and set real schedule dates if the offer is time-limited.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('The new collection', 'wconvert'),
        'headline' => __('A fresh perspective.', 'wconvert'),
        'body' => __('Explore the latest pieces, made for everyday living.', 'wconvert'),
        'cta_label' => __('Explore the collection', 'wconvert'),
        'fine_print' => __('Explore the collection for current prices and availability.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

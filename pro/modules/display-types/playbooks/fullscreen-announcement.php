<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fullscreen-announcement',
    'name' => __('Introduce a seasonal collection', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'fullscreen-poster',
    'notes' => __('Replace the collection URL and sample copy. Use a deliberate trigger, relevant pages and a restrained frequency. Configure real start and end dates for a limited campaign.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('The new collection', 'wconvert'),
        'headline' => __('A fresh perspective.', 'wconvert'),
        'body' => __('Explore the latest pieces, made for everyday living.', 'wconvert'),
        'cta_label' => __('Explore the collection', 'wconvert'),
        'fine_print' => __('Explore the collection for current prices and availability.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 15,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'fullscreen-announcement',
    'name' => __('Introduce a seasonal collection', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'fullscreen-poster',
    'notes' => __('Replace the collection URL and sample copy. Use a deliberate trigger, relevant pages and a restrained frequency. Configure real start and end dates for a limited campaign.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('The new collection', 'wconvert-pro'),
        'headline' => __('A fresh perspective.', 'wconvert-pro'),
        'body' => __('Explore the latest pieces, made for everyday living.', 'wconvert-pro'),
        'cta_label' => __('Explore the collection', 'wconvert-pro'),
        'fine_print' => __('Explore the collection for current prices and availability.', 'wconvert-pro'),
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

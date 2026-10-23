<?php

defined('ABSPATH') || exit;

return [
    'id' => 'opening-hours-signpost',
    'name' => __('Point visitors to current opening hours', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'inline-signpost',
    'business_types' => ['services'],
    'notes' => __('Link to current hours and exceptional closures. Show on contact or location pages, avoiding irrelevant pages and repeated interruptions.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('Service update', 'wconvert-pro'),
        'headline' => __('Planning a visit?', 'wconvert-pro'),
        'cta_label' => __('Check current opening hours', 'wconvert-pro'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];

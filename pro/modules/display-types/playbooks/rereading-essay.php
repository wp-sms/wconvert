<?php

defined('ABSPATH') || exit;

return [
    'id' => 'rereading-essay',
    'name' => __('Suggest an essay about rereading', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'margin-note',
    'business_types' => ['publishers'],
    'notes' => __('Link to a complete relevant essay. Show after the visitor has read related content and avoid repeated interruptions.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('Journal', 'wconvert-pro'),
        'fine_print' => __('Reading notes', 'wconvert-pro'),
        'headline' => __('The value of
reading twice.', 'wconvert-pro'),
        'body' => __('A second look. A new idea.', 'wconvert-pro'),
        'cta_label' => __('Read the essay', 'wconvert-pro'),
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

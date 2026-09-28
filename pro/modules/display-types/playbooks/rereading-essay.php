<?php

defined('ABSPATH') || exit;

return [
    'id' => 'rereading-essay',
    'name' => __('Suggest an essay about rereading', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'margin-note',
    'business_types' => ['publishers'],
    'notes' => __('Link to a complete relevant essay. Show after the visitor has read related content and avoid repeated interruptions.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Journal', 'wconvert'),
        'fine_print' => __('Reading notes', 'wconvert'),
        'headline' => __('The value of
reading twice.', 'wconvert'),
        'body' => __('A second look. A new idea.', 'wconvert'),
        'cta_label' => __('Read the essay', 'wconvert'),
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

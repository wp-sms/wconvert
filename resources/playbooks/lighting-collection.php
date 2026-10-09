<?php

defined('ABSPATH') || exit;

return [
    'id' => 'lighting-collection',
    'name' => __('Introduce a lighting collection', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'collection-poster',
    'business_types' => ['stores'],
    'notes' => __('Link to a real lighting collection with product specifications. Replace the original illustrative lamps if they misrepresent your products.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('The lighting edit', 'wconvert'),
        'headline' => __('A softer kind of evening.', 'wconvert'),
        'body' => __('Table lamps for reading corners and quiet rooms.', 'wconvert'),
        'cta_label' => __('Explore the lighting edit', 'wconvert'),
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

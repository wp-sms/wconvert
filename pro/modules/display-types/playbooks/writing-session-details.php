<?php

defined('ABSPATH') || exit;

return [
    'id' => 'writing-session-details',
    'name' => __('Explore practical writing sessions', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'session-card',
    'business_types' => [
        'publishers',
    ],
    'notes' => __('Link to a real page explaining the writing-session format, accessibility, current dates and attendance process. Show on writing-advice pages. This link does not reserve a place or collect details.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('At the writing desk', 'wconvert'),
        'headline' => __('Make room for your next draft.', 'wconvert'),
        'body' => __('Explore our writing sessions: the format, who they suit and how to take part.', 'wconvert'),
        'cta_label' => __('Explore writing sessions', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 20,
        ],
    ],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];

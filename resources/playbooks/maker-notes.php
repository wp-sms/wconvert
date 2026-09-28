<?php

defined('ABSPATH') || exit;

return [
    'id' => 'maker-notes',
    'name' => __('Share the stories behind your products', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'quieter-frequency',
    'business_types' => ['stores'],
    'notes' => __('Offer a real editorial programme on about and maker-story pages. Assign someone to write the monthly note.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('The making of things', 'wconvert'),
            __('Thank you', 'wconvert')
        ],
        'headline' => __('From the workshop.', 'wconvert'),
        'body' => __('A monthly note about materials, making and the people behind the pieces.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me the monthly maker notes. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request the maker notes', 'wconvert'),
        'fine_print' => [
            __('You can unsubscribe at any time.', 'wconvert'),
            __('You can unsubscribe at any time.', 'wconvert')
        ],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'editorial-weekly',
    'name' => __('Offer a weekly editorial letter', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'ledger-card',
    'business_types' => ['publishers'],
    'notes' => __('Use on editorial pages with an established weekly publishing schedule. Keep the frequency promise realistic.', 'wconvert'),
    'copy' => [
        'headline' => __('One good read. Every Friday.', 'wconvert'),
        'body' => [
            __('An essay worth making time for.', 'wconvert'),
            __('A question to think about.', 'wconvert'),
            __('A useful link to keep.', 'wconvert')
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the Friday letter', 'wconvert'),
        'consent_text' => __('Email me the Friday letter. I can unsubscribe anytime.', 'wconvert'),
        'fine_print' => __('You can unsubscribe at any time.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

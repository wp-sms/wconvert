<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'maintenance-letter',
    'name' => __('Offer monthly home maintenance notes', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'reading-desk',
    'notes' => __('Embed after a maintenance article. Connect your email destination and prepare the monthly programme. This is an ongoing newsletter, not an appointment reminder or emergency advice service.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Small jobs, thoughtfully timed', 'wconvert'), __('The monthly home note', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => __('A little care.
Each month.', 'wconvert'),
        'body' => __('One monthly email with practical home maintenance tasks and seasonal checks.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me the monthly home maintenance notes. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request the monthly note', 'wconvert'),
        'fine_print' => __('Monthly notes. Unsubscribe anytime.', 'wconvert'),
        'success_headline' => __('Your request is received', 'wconvert'),
        'success_body' => __('Thank you for asking for the monthly home maintenance notes.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

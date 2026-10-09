<?php

defined('ABSPATH') || exit;

return [
    'id' => 'writing-checklist',
    'name' => __('Offer a seven-point writing checklist', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'useful-guide',
    'business_types' => ['publishers'],
    'notes' => __('Create the promised seven checks and configure resource email. Add the actual checklist address to the optional follow-up link before publishing.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('THE DRAFT CHECKLIST', 'wconvert'),
            __('START WITH ONE PASS', 'wconvert')
        ],
        'headline' => [
            __('07', 'wconvert'),
            __('Give your draft
a second look.', 'wconvert')
        ],
        'body' => [
            __('Checks for a
clearer draft.', 'wconvert'),
            __('Seven checks for structure, evidence and a useful ending.', 'wconvert')
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Send me the writing checklist I requested.', 'wconvert'),
        'cta_label' => __('Request the writing checklist', 'wconvert'),
        'fine_print' => [
            __('One checklist email. No newsletter signup.', 'wconvert'),
            __('Your request is for the writing checklist.', 'wconvert')
        ],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => [
            __('Thank you. Your writing checklist request has been received.', 'wconvert'),
            __('Read your opening aloud. Is the point clear before the detail begins?', 'wconvert')
        ],
        'success_action' => [
            'label' => __('Open the writing checklist', 'wconvert')
        ]
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

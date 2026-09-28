<?php

defined('ABSPATH') || exit;

return [
    'id' => 'reading-notes-guide',
    'name' => __('Offer a practical reading guide', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'reading-cover',
    'business_types' => ['publishers'],
    'notes' => __('Create the five-part reading guide, configure resource email and set the acknowledgement resource link. This request is not a newsletter signup.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('A practical guide', 'wconvert'),
        'headline' => [__('Read.
Notice.
Remember.', 'wconvert'), __('Keep more of what you read.', 'wconvert')],
        'body' => [__('Five ways to get more from a book.', 'wconvert'), __('A short guide to choosing a question, taking notes and returning to useful ideas.', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the guide', 'wconvert'),
        'fine_print' => __('One guide email. No newsletter signup.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. Your request for the reading guide is received.', 'wconvert'),
        'success_action' => [
            'label' => __('Open the reading guide', 'wconvert'),
        ],
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
    'destination_hint' => [
        'types' => ['lead_magnet_email'],
        'fields' => ['email'],
    ],
];

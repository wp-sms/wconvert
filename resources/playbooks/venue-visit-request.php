<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'venue-visit-request',
    'name' => __('Request a wedding venue visit', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'notes' => __('Use on the venue tour page. Configure who follows up and replace the visit options with spaces actually available. Confirm dates and availability separately; this form cannot book a visit.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Come and take a look', 'wconvert'),
        'headline' => __('Picture your day here.', 'wconvert'),
        'body' => __('Ask about visiting the venue before choosing a date.', 'wconvert'),
        'interest_label' => __('What would you like to explore? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a space', 'wconvert'),
        'interest_options' => [
            'options' => [[
                    'value' => 'ceremony',
                    'label' => __('Ceremony spaces', 'wconvert'),
                ], [
                    'value' => 'reception',
                    'label' => __('Reception spaces', 'wconvert'),
                ], [
                    'value' => 'both',
                    'label' => __('Both', 'wconvert'),
                ]],
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Contact me about visiting the venue.', 'wconvert'),
        'cta_label' => __('Request a venue visit', 'wconvert'),
        'fine_print' => __('We use your details to reply. Your visit is not booked yet.', 'wconvert'),
        'success_headline' => __('Visit request received', 'wconvert'),
        'success_body' => __('Thank you for asking to visit. A date and time still need to be agreed.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

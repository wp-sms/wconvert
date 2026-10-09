<?php

defined('ABSPATH') || exit;

return [
    'id' => 'cleaning-quote',
    'name' => __('Request a home cleaning estimate', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'service-docket',
    'business_types' => ['services'],
    'notes' => __('Place on cleaning service pages. Follow up for property size, location and timing before quoting. No appointment is booked.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('A practical next step', 'wconvert'),
            __('Thank you', 'wconvert')
        ],
        'headline' => __('A cleaner home. A clear next step.', 'wconvert'),
        'body' => __('Tell us the kind of clean you need. We will use your email to discuss the scope.', 'wconvert'),
        'fine_print' => [
            __('An estimate request. No booking or payment.', 'wconvert'),
            __('We use your details to respond to this request.', 'wconvert')
        ],
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Your name', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'interest_label' => __('What kind of clean? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a service', 'wconvert'),
        'interest_options' => [
            'options' => [
                [
                    'value' => 'regular',
                    'label' => __('Regular cleaning', 'wconvert')
                ],
                [
                    'value' => 'deep',
                    'label' => __('A deep clean', 'wconvert')
                ],
                [
                    'value' => 'moving',
                    'label' => __('Moving in or out', 'wconvert')
                ]
            ]
        ],
        'consent_text' => __('Contact me about this cleaning request.', 'wconvert'),
        'cta_label' => __('Request a cleaning estimate', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

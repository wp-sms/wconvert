<?php

defined('ABSPATH') || exit;

return [
    'id' => 'tutoring-introduction',
    'name' => __('Ask about a tutoring introduction', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['services'],
    'notes' => __('Ask adults to enquire on behalf of children. Avoid collecting children’s contact details or sensitive learning information here. Confirm suitability and availability before booking.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Start with a conversation', 'wconvert'),
        'headline' => __('A little clarity before the first lesson.', 'wconvert'),
        'body' => __('Ask which lesson format could work for your learner. We will reply by email.', 'wconvert'),
        'interest_label' => __('What would you like to discuss? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose an option', 'wconvert'),
        'interest_options' => [
            'options' => [
                [
                    'value' => 'individual',
                    'label' => __('Individual lessons', 'wconvert')
                ],
                [
                    'value' => 'group',
                    'label' => __('Small-group lessons', 'wconvert')
                ],
                [
                    'value' => 'advice',
                    'label' => __('Help choosing a format', 'wconvert')
                ]
            ]
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Reply to my tutoring enquiry.', 'wconvert'),
        'cta_label' => __('Request an introduction', 'wconvert'),
        'fine_print' => __('We use your details to respond to this request. No appointment is confirmed.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

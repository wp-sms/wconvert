<?php

defined('ABSPATH') || exit;

return [
    'id' => 'landscaping-enquiry',
    'name' => __('Start a garden landscaping enquiry', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'journey-enquiry',
    'business_types' => ['services'],
    'notes' => __('Ask the project type first, then contact details. The answers remain a single enquiry. Review the brief before arranging a site visit.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:request' => [
                'headline' => __('What would you like to change?', 'wconvert'),
                'interest_label' => __('Your garden project', 'wconvert'),
                'interest_options' => [
                    'options' => [
                        [
                            'value' => 'planting',
                            'label' => __('Planting and borders', 'wconvert')
                        ],
                        [
                            'value' => 'layout',
                            'label' => __('A new garden layout', 'wconvert')
                        ],
                        [
                            'value' => 'maintenance',
                            'label' => __('Maintenance advice', 'wconvert')
                        ]
                    ]
                ],
                'next_label' => __('Continue', 'wconvert')
            ],
            'submission:email-interest-name' => [
                'headline' => __('Let us discuss your garden', 'wconvert'),
                'name_label' => __('Your name (optional)', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'fine_print' => __('We use your details to discuss this enquiry. A site visit is not booked yet.', 'wconvert'),
                'back_label' => __('Back', 'wconvert'),
                'cta_label' => __('Send my garden enquiry', 'wconvert')
            ],
            'acknowledgement' => [
                'success_headline' => __('Garden enquiry received', 'wconvert'),
                'success_body' => __('Thank you. Your project details have been received for review.', 'wconvert')
            ]
        ]
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

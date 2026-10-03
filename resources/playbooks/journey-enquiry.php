<?php

defined('ABSPATH') || exit;

return [
    'id' => 'journey-enquiry',
    'name' => __('Enquiry in small steps', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'journey-enquiry',
    'notes' => __('Ask what the visitor needs before requesting contact details. Save the whole request when they submit.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:request' => [
                'headline' => __('Tell us what you need', 'wconvert'),
                'interest_label' => __('What can we help with?', 'wconvert'),
                'interest_options' => [
                    'options' => [[
                        'value' => 'consultation',
                        'label' => __('A consultation', 'wconvert'),
                    ], [
                        'value' => 'quote',
                        'label' => __('A quote', 'wconvert'),
                    ]],
                ],
                'next_label' => __('Continue', 'wconvert'),
            ],
            'submission:email-interest-name' => [
                'headline' => __('How can we contact you?', 'wconvert'),
                'name_label' => __('Your name', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'fine_print' => [
                    'text' => __('We will use these details to respond to your request.', 'wconvert'),
                ],
                'back_label' => __('Back', 'wconvert'),
                'cta_label' => __('Send my enquiry', 'wconvert'),
            ],
            'acknowledgement' => [
                'success_headline' => __('Details received', 'wconvert'),
                'success_body' => [
                    'text' => __('Thank you. We have received the details you submitted.', 'wconvert'),
                ],
            ],
        ],
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 8]],
    // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude -- a Targeting rule list, not a get_posts() argument; no query is built from it.
    'targeting' => ['include' => [], 'exclude' => []],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

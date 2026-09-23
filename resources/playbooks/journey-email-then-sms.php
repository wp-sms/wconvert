<?php

defined('ABSPATH') || exit;

return [
    'id' => 'journey-email-then-sms',
    'name' => __('Email with optional SMS', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'journey-email-then-sms',
    'notes' => __('Save the email signup first, then offer an optional text signup. Closing the second screen keeps the email request.', 'wconvert'),
    'copy' => [
        'screens' => [
            'submission:email' => [
                'headline' => __('Get our email updates', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'consent_text' => [
                    'text' => __('Email me news and offers.', 'wconvert'),
                ],
                'cta_label' => __('Sign up for email', 'wconvert'),
            ],
            'submission:phone' => [
                'headline' => __('Would you also like text updates?', 'wconvert'),
                'body' => [
                    'text' => __('Your email signup request was received. This next step is optional.', 'wconvert'),
                ],
                'phone_label' => __('Phone number', 'wconvert'),
                'consent_text' => [
                    'text' => __('Send me news and offers by text message.', 'wconvert'),
                ],
                'back_label' => __('Review email', 'wconvert'),
                'cta_label' => __('Sign up for SMS', 'wconvert'),
                'skip_label' => __('Finish without SMS', 'wconvert'),
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
    'targeting' => ['include' => [], 'exclude' => []],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

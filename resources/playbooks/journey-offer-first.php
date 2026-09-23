<?php

defined('ABSPATH') || exit;

return [
    'id' => 'journey-offer-first',
    'name' => __('Introduce the signup first', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'journey-offer-first',
    'notes' => __('Explain the offer before asking for an email address. Continue does not save anything.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:offer' => [
                'headline' => __('Want occasional updates?', 'wconvert'),
                'body' => [
                    'text' => __('Find out what is new and receive our latest offers.', 'wconvert'),
                ],
                'next_label' => __('Show me the signup', 'wconvert'),
                'close_label' => __('No thanks', 'wconvert'),
            ],
            'submission:email' => [
                'headline' => __('Get our email updates', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'consent_text' => [
                    'text' => __('Email me news and offers.', 'wconvert'),
                ],
                'cta_label' => __('Sign up for email', 'wconvert'),
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

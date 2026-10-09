<?php

defined('ABSPATH') || exit;

return [
    'id' => 'upholstery-samples',
    'name' => __('Invite a fabric sample enquiry', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'sample-envelope',
    'business_types' => ['stores'],
    'notes' => __('Use near upholstery options. Explain sample availability and postage in follow-up; monitor capture history for the optional answer, which not every destination forwards.', 'wconvert'),
    'copy' => [
        'headline' => __('Find the right fabric.', 'wconvert'),
        'body' => __('Ask about samples before choosing your upholstery.', 'wconvert'),
        'interest_label' => __('What matters most? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose an option', 'wconvert'),
        'interest_options' => [
            'options' => [[
                    'value' => 'feel',
                    'label' => __('How it feels', 'wconvert'),
                ], [
                    'value' => 'colour',
                    'label' => __('Matching a colour', 'wconvert'),
                ], [
                    'value' => 'care',
                    'label' => __('Everyday care', 'wconvert'),
                ]],
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Ask about fabric samples', 'wconvert'),
        'fine_print' => __('We use your details to respond. Samples and postage are agreed separately.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Your fabric sample enquiry is received. No sample order or payment has been made.', 'wconvert'),
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

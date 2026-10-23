<?php

defined('ABSPATH') || exit;

return [
    'id' => 'upholstery-samples',
    'name' => __('Invite a fabric sample enquiry', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'sample-envelope',
    'business_types' => ['stores'],
    'notes' => __('Use near upholstery options. Explain sample availability and postage in follow-up; monitor capture history for the optional answer, which not every destination forwards.', 'wconvert-pro'),
    'copy' => [
        'headline' => __('Find the right fabric.', 'wconvert-pro'),
        'body' => __('Ask about samples before choosing your upholstery.', 'wconvert-pro'),
        'interest_label' => __('What matters most? (optional)', 'wconvert-pro'),
        'interest_placeholder' => __('Choose an option', 'wconvert-pro'),
        'interest_options' => [
            'options' => [[
                    'value' => 'feel',
                    'label' => __('How it feels', 'wconvert-pro'),
                ], [
                    'value' => 'colour',
                    'label' => __('Matching a color', 'wconvert-pro'),
                ], [
                    'value' => 'care',
                    'label' => __('Everyday care', 'wconvert-pro'),
                ]],
        ],
        'email_label' => __('Email address', 'wconvert-pro'),
        'email_placeholder' => __('you@example.com', 'wconvert-pro'),
        'cta_label' => __('Ask about fabric samples', 'wconvert-pro'),
        'fine_print' => __('We use your details to respond. Samples and postage are agreed separately.', 'wconvert-pro'),
        'success_headline' => __('Request received', 'wconvert-pro'),
        'success_body' => __('Your fabric sample enquiry is received. No sample order or payment has been made.', 'wconvert-pro'),
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

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'home-repair-quote',
    'name' => __('Request a home repair quote', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'service-docket',
    'notes' => __('Place inline on the relevant service page. Edit service choices and arrange who reviews and replies to requests. No quote or appointment is automatically confirmed.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A practical next step', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => __('Small repair.
Fresh start.', 'wconvert'),
        'body' => __('Tell us which part of your home needs attention. We will use your details to discuss the job.', 'wconvert'),
        'fine_print' => [__('A request for a quote. No booking or payment is made here.', 'wconvert'), __('We use your details to respond to this request.', 'wconvert')],
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Your name', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'interest_label' => __('What needs attention? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a service', 'wconvert'),
        'interest_options' => [
            'options' => [[
                    'value' => 'repair',
                    'label' => __('A repair', 'wconvert'),
                ], [
                    'value' => 'installation',
                    'label' => __('An installation', 'wconvert'),
                ], [
                    'value' => 'advice',
                    'label' => __('Help deciding', 'wconvert'),
                ]],
        ],
        'consent_text' => __('Contact me about this home repair request.', 'wconvert'),
        'cta_label' => __('Request a repair quote', 'wconvert'),
        'success_headline' => __('Your request is received.', 'wconvert'),
        'success_body' => __('Thank you for describing what you need. This is a quote request, not a confirmed booking.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

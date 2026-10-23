<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-enquiry',
    'name' => __('Route a service enquiry', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'journey-service-enquiry',
    'notes' => __('Ask what the visitor needs, show only the relevant follow-up, then capture an email with the answers. Review the wording and destination before publishing.', 'wconvert-pro'),
    'copy' => ['screens' => [
        'screen:service' => [
            'headline' => __('Tell us what you need', 'wconvert-pro'),
            'next_label' => __('Continue', 'wconvert-pro'),
        ],
        'screen:repair' => [
            'headline' => __('What happens next', 'wconvert-pro'),
            'body' => ['text' => __('Leave your email on the next screen. We can then ask about the item, its condition and any useful photos. We agree the assessment and any costs before work begins.', 'wconvert-pro')],
            'next_label' => __('Continue to contact details', 'wconvert-pro'),
            'back_label' => __('Back', 'wconvert-pro'),
        ],
        'submission:email' => [
            'headline' => __('How can we reach you?', 'wconvert-pro'),
            'email_label' => __('Email address', 'wconvert-pro'),
            'email_placeholder' => __('you@example.com', 'wconvert-pro'),
            'cta_label' => __('Send enquiry', 'wconvert-pro'),
            'back_label' => __('Back', 'wconvert-pro'),
        ],
        'acknowledgement' => [
            'success_headline' => __('Request received', 'wconvert-pro'),
            'success_body' => ['text' => __('We will review your enquiry and reply using the details you supplied.', 'wconvert-pro')],
            'back_label' => __('Back', 'wconvert-pro'),
        ],
    ]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

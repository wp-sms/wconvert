<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-enquiry',
    'name' => __('Route a service enquiry', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'journey-service-enquiry',
    'notes' => __('Ask what the visitor needs, show only the relevant follow-up, then capture an email with the answers. Review the wording and destination before publishing.', 'wconvert'),
    'copy' => ['screens' => [
        'screen:service' => [
            'headline' => __('Tell us what you need', 'wconvert'),
            'next_label' => __('Continue', 'wconvert'),
        ],
        'screen:repair' => [
            'headline' => __('A little about the repair', 'wconvert'),
            'body' => ['text' => __('We can usually advise after hearing about the item.', 'wconvert')],
            'next_label' => __('Continue', 'wconvert'),
            'back_label' => __('Back', 'wconvert'),
        ],
        'submission:email' => [
            'headline' => __('How can we reach you?', 'wconvert'),
            'email_label' => __('Email address', 'wconvert'),
            'cta_label' => __('Send enquiry', 'wconvert'),
            'back_label' => __('Back', 'wconvert'),
        ],
        'acknowledgement' => [
            'success_headline' => __('Request received', 'wconvert'),
            'success_body' => ['text' => __('We will review your enquiry and reply using the details you supplied.', 'wconvert')],
            'back_label' => __('Back', 'wconvert'),
        ],
    ]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'repair-advice-request',
    'name' => __('Start a furniture repair enquiry', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'request-folio',
    'business_types' => [
        'services',
    ],
    'notes' => __('Show on furniture repair service pages. Continue saves nothing; submit saves the optional item and reply email together. Check enquiries and request photos in your reply if needed. Do not enrol enquirers in marketing.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:request' => [
                'eyebrow' => __('1 / Your request', 'wconvert'),
                'fine_print' => __('Two short steps', 'wconvert'),
                'headline' => __('Could it be repaired?', 'wconvert'),
                'interest_label' => __('What needs attention? (optional)', 'wconvert'),
                'interest_placeholder' => __('Choose an item', 'wconvert'),
                'interest_options' => [
                    'options' => [
                        [
                            'value' => 'chair',
                            'label' => __('A chair', 'wconvert'),
                        ],
                        [
                            'value' => 'table',
                            'label' => __('A table', 'wconvert'),
                        ],
                        [
                            'value' => 'other',
                            'label' => __('Another piece', 'wconvert'),
                        ],
                    ],
                ],
                'next_label' => __('Continue to email', 'wconvert'),
                'body' => __('No photos or measurements needed to start.', 'wconvert'),
            ],
            'submission:email-interest' => [
                'eyebrow' => __('2 / Reply address', 'wconvert'),
                'fine_print' => __('Two short steps', 'wconvert'),
                'headline' => __('Where can we reply?', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'email_placeholder' => __('you@example.com', 'wconvert'),
                'cta_label' => __('Send request', 'wconvert'),
                'back_label' => __('Back', 'wconvert'),
                'body' => __('We use your email to discuss this request. This is not a booking.', 'wconvert'),
            ],
            'acknowledgement' => [
                'success_headline' => __('Your request is received.', 'wconvert'),
                'success_body' => __('Thank you. We have received your repair enquiry. No repair or appointment has been confirmed.', 'wconvert'),
            ],
        ],
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 20,
        ],
    ],
    'destination_hint' => [
        'types' => [],
        'fields' => [
            'email',
        ],
    ],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'journey-email-then-sms',
    'name' => __('Launch updates with optional SMS', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'journey-email-then-sms',
    'notes' => __('Configure email and SMS destinations and separate consent wording. SMS is optional; skipping it preserves the email request.', 'wconvert'),
    'copy' => [
        'screens' => [
            'submission:email' => [
                'headline' => __('First to know. Your choice how.', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'consent_text' => __('Email me new-collection announcements.', 'wconvert'),
                'cta_label' => __('Request launch emails', 'wconvert'),
            ],
            'submission:phone' => [
                'headline' => __('Want a text for the next launch?', 'wconvert'),
                'body' => __('Your email signup request was received. This next step is optional.', 'wconvert'),
                'phone_label' => __('Phone number', 'wconvert'),
                'consent_text' => __('Text me new-collection announcements.', 'wconvert'),
                'back_label' => __('Review email', 'wconvert'),
                'cta_label' => __('Request launch texts', 'wconvert'),
                'skip_label' => __('Finish without SMS', 'wconvert'),
            ],
            'acknowledgement' => [
                'success_headline' => __('Details received', 'wconvert'),
                'success_body' => __('Thank you. We have received the details you submitted.', 'wconvert'),
            ],
        ],
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 15,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

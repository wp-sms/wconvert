<?php

defined('ABSPATH') || exit;

return [
    'id' => 'journey-email-only',
    'name' => __('Email signup', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'journey-email-only',
    'notes' => __('A short email signup with one clear submission.', 'wconvert'),
    'copy' => [
        'headline' => __('Get our email updates', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'consent_text' => [
            'text' => __('Email me news and offers.', 'wconvert'),
        ],
        'cta_label' => __('Sign up for email', 'wconvert'),
        'success_headline' => __('Details received', 'wconvert'),
        'success_body' => [
            'text' => __('Thank you. We have received the details you submitted.', 'wconvert'),
        ],
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 8]],
    'targeting' => ['include' => [], 'exclude' => []],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

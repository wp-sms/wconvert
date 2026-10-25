<?php

defined('ABSPATH') || exit;

return [
    'id' => 'restyling-notes',
    'name' => __('Offer useful room restyling ideas', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'benefit-grid',
    'business_types' => ['stores'],
    'notes' => __('Place on home styling content. The promise is useful editorial advice, not a discount or design consultation.', 'wconvert'),
    'copy' => [
        'headline' => __('A fresh look. With what you own.', 'wconvert'),
        'body' => [
            __('One monthly email with practical ways to rethink a room.', 'wconvert'),
            __('Move one thing', 'wconvert'),
            __('Try a new pairing', 'wconvert'),
            __('Make space to enjoy it', 'wconvert')
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request room ideas', 'wconvert'),
        'consent_text' => __('Email me monthly room ideas. I can unsubscribe anytime.', 'wconvert'),
        'fine_print' => __('You can unsubscribe at any time.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

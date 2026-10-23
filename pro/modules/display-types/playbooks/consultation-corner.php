<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'consultation-corner',
    'name' => __('Ask about a design consultation', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-photo',
    'notes' => __('Edit the consultation wording and picture. Show on relevant service pages and arrange who replies. A request does not confirm an appointment.', 'wconvert-pro'),
    'copy' => [
        'badge' => __('A first conversation', 'wconvert-pro'),
        'headline' => __('A fresh eye on your space.', 'wconvert-pro'),
        'body' => __('Leave your email to discuss a design consultation.', 'wconvert-pro'),
        'email_label' => __('Email address', 'wconvert-pro'),
        'email_placeholder' => __('you@example.com', 'wconvert-pro'),
        'cta_label' => __('Request a conversation', 'wconvert-pro'),
        'consent_text' => __('Contact me about this consultation request.', 'wconvert-pro'),
        'success_headline' => __('Request received', 'wconvert-pro'),
        'success_body' => __('Thank you. We have received your consultation request. No appointment is booked.', 'wconvert-pro'),
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

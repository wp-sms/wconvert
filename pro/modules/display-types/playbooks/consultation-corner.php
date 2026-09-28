<?php

defined('ABSPATH') || exit;

return [
    'id' => 'consultation-corner',
    'name' => __('Ask about a design consultation', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-photo',
    'notes' => __('Edit the consultation wording and picture. Show on relevant service pages and arrange who replies. A request does not confirm an appointment.', 'wconvert'),
    'copy' => [
        'badge' => __('A first conversation', 'wconvert'),
        'headline' => __('A fresh eye on your space.', 'wconvert'),
        'body' => __('Leave your email to discuss a design consultation.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request a conversation', 'wconvert'),
        'consent_text' => __('Contact me about this consultation request.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your consultation request. No appointment is booked.', 'wconvert'),
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

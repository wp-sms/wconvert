<?php

defined('ABSPATH') || exit;

return [
    'id' => 'photography-enquiry',
    'name' => __('Enquire about a portrait session', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'portrait-frame',
    'notes' => __('Replace the illustration with your own work if desired and configure a relevant portfolio-page trigger. Arrange who replies; this captures an enquiry and does not book a session.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A portrait, with personality', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => __('Let’s plan
your portrait.', 'wconvert'),
        'body' => __('Leave an email to discuss a portrait session, availability and the approach that feels right for you.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Contact me about my portrait enquiry.', 'wconvert'),
        'cta_label' => __('Enquire about a session', 'wconvert'),
        'fine_print' => __('An enquiry only. Your session is confirmed separately.', 'wconvert'),
        'success_headline' => __('A good place to start.', 'wconvert'),
        'success_body' => __('Your portrait enquiry has been received. No appointment has been booked.', 'wconvert'),
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

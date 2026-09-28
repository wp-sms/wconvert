<?php

defined('ABSPATH') || exit;

return [
    'id' => 'local-class-news',
    'name' => __('Offer local class announcements', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'bar-email-capture',
    'business_types' => ['services'],
    'notes' => __('Use on class information pages. Assign an owner for announcements and link each future message to actual dates and booking terms.', 'wconvert'),
    'copy' => ['headline' => __('A new class, when it is ready.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Email me new-class announcements. I can unsubscribe anytime.', 'wconvert'), 'cta_label' => __('Request class news', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. Your request for announcements has been received.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'repair-workshop-news',
    'name' => __('Offer repair workshop announcements', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'bar-email-capture',
    'business_types' => ['stores'],
    'notes' => __('Use on repair and care pages. Send only real workshop announcements; event registration is a separate step.', 'wconvert-pro'),
    'copy' => ['headline' => __('Hear about hands-on repair sessions.', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Email me repair workshop announcements. I can unsubscribe anytime.', 'wconvert-pro'), 'cta_label' => __('Request workshop news', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. Your request for announcements has been received.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

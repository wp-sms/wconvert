<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fullscreen-guide',
    'name' => __('Offer a guide in fullscreen', 'wconvert-pro'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'fullscreen-split',
    'notes' => __('Offer a guide after meaningful reading progress. Replace the sample resource, configure a lead-magnet delivery destination and add the file. Review frequency and page targeting before publishing.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('A practical field guide', 'wconvert-pro'),
        'headline' => __("Make room\nfor better work.", 'wconvert-pro'),
        'body' => __('Seven practical ways to organize a calmer working week.', 'wconvert-pro'),
        'email_label' => __('Email address', 'wconvert-pro'),
        'email_placeholder' => __('you@example.com', 'wconvert-pro'),
        'cta_label' => __('Request the guide', 'wconvert-pro'),
        'consent_text' => __('Use my email to send the requested guide.', 'wconvert-pro'),
        'fine_print' => ['text' => __('One requested guide. No newsletter signup. %s', 'wconvert-pro'), 'link' => ['label' => __('Privacy Policy', 'wconvert-pro')]],
        'success_headline' => __('Request received', 'wconvert-pro'),
        'success_body' => __('Your guide request has been received.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'scroll_depth', 'percent' => 50]],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

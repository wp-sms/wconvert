<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fullscreen-guide',
    'name' => __('Offer a guide in fullscreen', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'fullscreen-split',
    'notes' => __('Offer a guide after meaningful reading progress. Replace the sample resource, configure a lead-magnet delivery destination and add the file. Review frequency and page targeting before publishing.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('A practical field guide', 'wconvert'),
        'headline' => __("Make room\nfor better work.", 'wconvert'),
        'body' => __('Seven practical ways to organise a calmer working week.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the guide', 'wconvert'),
        'consent_text' => __('I agree to receive these emails.', 'wconvert'),
        'fine_print' => ['text' => __('We use your details for this request. %s', 'wconvert'), 'link' => ['label' => __('Privacy Policy', 'wconvert')]],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you for your request.', 'wconvert'),
    ],
    'rules' => [['type' => 'scroll_depth', 'percent' => 50]],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

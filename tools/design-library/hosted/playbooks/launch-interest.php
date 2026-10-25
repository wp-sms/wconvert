<?php

defined('ABSPATH') || exit;

return [
    'id' => 'launch-interest',
    'name' => __('Collect interest before a product launch', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'ink-split',
    'business_types' => ['stores'],
    'notes' => __('Use only for a planned release with an owner and announcement date. This records interest; it does not reserve products.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('In development', 'wconvert'),
        'headline' => __('A first look. Soon.', 'wconvert'),
        'body' => __('Request an email when our next release is ready to explore.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request launch news', 'wconvert'),
        'consent_text' => __('Email me news about this launch. I can unsubscribe anytime.', 'wconvert'),
        'fine_print' => __('Launch news only. This is not a preorder.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

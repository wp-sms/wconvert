<?php

defined('ABSPATH') || exit;

return [
    'id' => 'sizing-guide',
    'name' => __('Help shoppers measure before choosing a size', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'inline-split',
    'business_types' => ['stores'],
    'notes' => __('Embed below sizing advice. Supply an accurate guide for the collection and configure its resource email. Do not imply that a generic chart fits every product.', 'wconvert'),
    'copy' => [
        'headline' => __('Find your fit. Start with a measure.', 'wconvert'),
        'body' => __('Request a measuring guide with the steps and size chart for this collection.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the size guide', 'wconvert'),
        'consent_text' => __('Send me the size guide I requested.', 'wconvert'),
        'fine_print' => __('One resource email. No newsletter signup.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

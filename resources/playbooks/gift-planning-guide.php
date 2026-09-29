<?php

defined('ABSPATH') || exit;

return [
    'id' => 'gift-planning-guide',
    'name' => __('Offer a thoughtful gift planning guide', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'name-and-email',
    'business_types' => ['stores'],
    'notes' => __('Place on gift inspiration pages. Provide a useful guide and configure its resource email. Update recommendations as availability changes.', 'wconvert'),
    'copy' => [
        'headline' => __('Find a gift with a little thought.', 'wconvert'),
        'body' => __('A guide to choosing by interests, occasion and what someone will actually use. Your name is optional.', 'wconvert'),
        'name_label' => __('First name (optional)', 'wconvert'),
        'name_placeholder' => __('Your name', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the gift guide', 'wconvert'),
        'consent_text' => __('Send me the gift guide I requested.', 'wconvert'),
        'fine_print' => __('One resource email. No newsletter signup.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

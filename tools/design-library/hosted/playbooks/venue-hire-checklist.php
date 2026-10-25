<?php

defined('ABSPATH') || exit;

return [
    'id' => 'venue-hire-checklist',
    'name' => __('Offer a venue hire planning checklist', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'resource-index',
    'business_types' => ['services'],
    'notes' => __('Embed in venue planning content. Provide a real checklist with capacity, access and timing questions, then configure its resource destination.', 'wconvert'),
    'copy' => ['eyebrow' => [__('Before you enquire', 'wconvert'), __('01', 'wconvert'), __('02', 'wconvert'), __('03', 'wconvert')], 'headline' => __('Find a venue that fits.', 'wconvert'), 'body' => [__('Three checks to prepare before discussing a venue hire.', 'wconvert'), __('List your practical needs', 'wconvert'), __('Check access and facilities', 'wconvert'), __('Prepare timing questions', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Send me the checklist I requested.', 'wconvert'), 'cta_label' => __('Request the checklist', 'wconvert'), 'fine_print' => __('One checklist email. No newsletter signup.', 'wconvert'), 'success_headline' => __('Checklist request received', 'wconvert'), 'success_body' => __('Thank you for requesting the checklist.', 'wconvert'), 'success_action' => __('Open the checklist', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

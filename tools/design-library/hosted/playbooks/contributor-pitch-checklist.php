<?php

defined('ABSPATH') || exit;

return [
    'id' => 'contributor-pitch-checklist',
    'name' => __('Offer an editorial pitch checklist', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'resource-index',
    'business_types' => ['publishers'],
    'notes' => __('Embed below contributor guidance. Provide the checklist and configure resource delivery. Requesting it does not submit a pitch or join a newsletter.', 'wconvert'),
    'copy' => ['eyebrow' => [__('Before you enquire', 'wconvert'), __('01', 'wconvert'), __('02', 'wconvert'), __('03', 'wconvert')], 'headline' => __('Give your idea a clear beginning.', 'wconvert'), 'body' => [__('Prepare a focused pitch before approaching an editor.', 'wconvert'), __('Identify the reader question', 'wconvert'), __('Outline the evidence', 'wconvert'), __('Explain your approach', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Send me the checklist I requested.', 'wconvert'), 'cta_label' => __('Request the checklist', 'wconvert'), 'fine_print' => __('One checklist email. No newsletter signup.', 'wconvert'), 'success_headline' => __('Checklist request received', 'wconvert'), 'success_body' => __('Thank you for requesting the checklist.', 'wconvert'), 'success_action' => __('Open the checklist', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

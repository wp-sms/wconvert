<?php

defined('ABSPATH') || exit;

return [
    'id' => 'project-readiness-guide',
    'name' => __('Help customers prepare for a contractor visit', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'project-notebook',
    'business_types' => ['services'],
    'notes' => __('Place on project advice pages. Supply a checklist matching the service and configure resource email. This neither assesses project readiness automatically nor books a visit.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Before the conversation', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => [__('03', 'wconvert'), __('Prepare for a useful conversation.', 'wconvert')],
        'body' => [__('Things to gather before a contractor visits.', 'wconvert'), __('Request a checklist for the photos, measurements and questions to prepare before discussing your project.', 'wconvert')],
        'fine_print' => [__('A contractor visit checklist', 'wconvert'), __('One resource email. No newsletter signup.', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Send me the contractor visit checklist I requested.', 'wconvert'),
        'cta_label' => __('Request the visit checklist', 'wconvert'),
        'success_headline' => __('Checklist request received.', 'wconvert'),
        'success_body' => __('Thank you for requesting the contractor visit checklist by email.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

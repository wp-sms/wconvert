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
        'eyebrow' => [
            __('Before the conversation', 'wconvert'),
            __('Request received', 'wconvert')
        ],
        'headline' => __('Before the visit.', 'wconvert'),
        'body' => __('Request a checklist for photos, measurements and questions to prepare before discussing your project.', 'wconvert'),
        'fine_print' => [
            __('One resource email. No newsletter signup.', 'wconvert'),
            __('One resource email. No newsletter signup.', 'wconvert')
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Send me the contractor visit checklist I requested.', 'wconvert'),
        'cta_label' => __('Request the visit checklist', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'project-planning-guide',
    'name' => __('Request a renovation planning checklist', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'project-notebook',
    'notes' => __('Create the promised checklist and configure the lead-magnet email destination. Test the actual resource and email acceptance before publishing.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('The project notebook', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => [__('07', 'wconvert'), __('Start with
a clearer plan.', 'wconvert')],
        'body' => [__('Decisions before
you renovate.', 'wconvert'), __('Request a seven-point checklist for planning a home renovation, from priorities to the first conversation.', 'wconvert')],
        'fine_print' => [__('A practical planning checklist', 'wconvert'), __('One resource request. No automatic marketing signup.', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Send me the renovation checklist I requested.', 'wconvert'),
        'cta_label' => __('Request the checklist', 'wconvert'),
        'success_headline' => __('Checklist request received.', 'wconvert'),
        'success_body' => __('Thank you for requesting the seven-point renovation checklist.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 15,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

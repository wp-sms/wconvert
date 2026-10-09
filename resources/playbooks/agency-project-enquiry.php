<?php

defined('ABSPATH') || exit;

return [
    'id' => 'agency-project-enquiry',
    'name' => __('Start a website project conversation', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-choice',
    'business_types' => ['services'],
    'notes' => __('Embed below agency services or portfolio work. Qualify scope, budget and timing in the reply instead of asking for an excessive first-contact form.', 'wconvert'),
    'copy' => [
        'headline' => __('A better website starts here.', 'wconvert'),
        'body' => __('Share the kind of project you are considering so we can discuss a useful next step.', 'wconvert'),
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Alex Morgan', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'interest_label' => __('What are you planning? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose an option', 'wconvert'),
        'interest_options' => [
            'options' => [
                [
                    'value' => 'new',
                    'label' => __('A new website', 'wconvert')
                ],
                [
                    'value' => 'redesign',
                    'label' => __('A redesign', 'wconvert')
                ],
                [
                    'value' => 'improve',
                    'label' => __('Improve an existing site', 'wconvert')
                ]
            ]
        ],
        'cta_label' => __('Send my project enquiry', 'wconvert'),
        'consent_text' => __('Contact me about this website project.', 'wconvert'),
        'fine_print' => __('We use your details to respond to this request. No appointment is confirmed.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

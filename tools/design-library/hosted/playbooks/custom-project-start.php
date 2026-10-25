<?php

defined('ABSPATH') || exit;

return [
    'id' => 'custom-project-start',
    'name' => __('Start a custom project enquiry', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'project-workboard',
    'business_types' => ['services'],
    'notes' => __('Embed on a custom-work page. Replace project categories with actual services and configure enquiry handling. No quotation, booking or payment is created.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('STUDIO / PROJECT DESK', 'wconvert'),
            __('NEW ENQUIRY', 'wconvert'),
            __('01 / THE STARTING POINT', 'wconvert'),
            __('02 / YOUR PROJECT', 'wconvert'),
            __('03 / KEEP THE CONVERSATION GOING', 'wconvert'),
            __('PROJECT DESK / RECEIVED', 'wconvert'),
        ],
        'headline' => [
            __('An idea worth
making real.', 'wconvert'),
            __('A room, an object,
a different way to use it.', 'wconvert'),
        ],
        'body' => [
            __('Tell us which kind of project you have in mind. We can discuss what a first conversation should cover.', 'wconvert'),
            __('We use your email to reply. No work is agreed yet.', 'wconvert'),
        ],
        'interest_label' => __('What are you planning? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose an option', 'wconvert'),
        'interest_options' => [
            'options' => [
                [
                    'value' => 'room',
                    'label' => __('A room or space', 'wconvert'),
                ],
                [
                    'value' => 'object',
                    'label' => __('A custom object', 'wconvert'),
                ],
                [
                    'value' => 'adaptation',
                    'label' => __('Adapting something existing', 'wconvert'),
                ],
            ],
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Start a project enquiry', 'wconvert'),
        'success_headline' => __('Your project enquiry is recorded', 'wconvert'),
        'success_body' => __('Thank you. Your email and any project type selected have been received. Scope, price and timing are still to be discussed.', 'wconvert'),
        'close_label' => __('Close', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

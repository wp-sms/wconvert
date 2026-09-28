<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'course-advice-request',
    'name' => __('Ask which course to start with', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'notes' => __('Use alongside course descriptions. Edit the experience choices and arrange an adviser response. This captures an advice request; it does not recommend a course automatically or enrol a learner.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('A little guidance first', 'wconvert'),
        'headline' => __('Find your
starting point.', 'wconvert'),
        'body' => __('Tell us where you are in your learning so an adviser can discuss suitable courses.', 'wconvert'),
        'interest_label' => __('Your experience (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a starting point', 'wconvert'),
        'interest_options' => [
            'options' => [[
                    'value' => 'new',
                    'label' => __('Completely new', 'wconvert'),
                ], [
                    'value' => 'returning',
                    'label' => __('Returning to learning', 'wconvert'),
                ], [
                    'value' => 'experienced',
                    'label' => __('Building on experience', 'wconvert'),
                ]],
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Contact me about choosing a course.', 'wconvert'),
        'cta_label' => __('Ask for course advice', 'wconvert'),
        'fine_print' => __('An advice request. No enrolment or payment is made here.', 'wconvert'),
        'success_headline' => __('Advice request received', 'wconvert'),
        'success_body' => __('Thank you. Your request has been recorded for follow-up; no course place is reserved.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

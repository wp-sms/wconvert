<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'topic-reading-list',
    'name' => __('Collect a reading preference with signup', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'preference-card',
    'notes' => __('Embed on your reading hub. Edit the topic choices and configure how they inform your email program. MailPoet can map interest to an existing custom text field for new subscribers; existing subscriber fields stay unchanged. Other destinations may not forward the choice. Do not promise personalized delivery until tested.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Read what interests you', 'wconvert'),
        'headline' => __('Your next
good read.', 'wconvert'),
        'body' => __('Tell us which subject you prefer for a weekly reading list.', 'wconvert'),
        'fine_print' => [__('One optional preference. One weekly email.', 'wconvert'), __('You can unsubscribe at any time.', 'wconvert')],
        'interest_label' => __('Favorite subject (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a subject', 'wconvert'),
        'interest_options' => [
            'options' => [[
                    'value' => 'books',
                    'label' => __('Books and writing', 'wconvert'),
                ], [
                    'value' => 'culture',
                    'label' => __('Arts and culture', 'wconvert'),
                ], [
                    'value' => 'ideas',
                    'label' => __('Science and ideas', 'wconvert'),
                ]],
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me the weekly reading list. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request my reading list', 'wconvert'),
        'success_headline' => __('Reading request received', 'wconvert'),
        'success_body' => __('Thank you for requesting the weekly reading list.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

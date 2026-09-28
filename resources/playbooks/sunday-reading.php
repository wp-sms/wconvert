<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'sunday-reading',
    'name' => __('Article-end Sunday reading list', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'reading-desk',
    'notes' => __('Place inline after a relevant article, connect your email service and make the publication cadence accurate. Review signup consent and the privacy notice.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A letter worth making time for', 'wconvert'), __('The Sunday reading list', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => __('Less scrolling.
More reading.', 'wconvert'),
        'body' => __('One thoughtful essay every Sunday. Books, places and ideas that stay with you.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me the Sunday reading list. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request the Sunday letter', 'wconvert'),
        'fine_print' => __('Weekly. Free to read. Unsubscribe anytime.', 'wconvert'),
        'success_headline' => __('A slower Sunday starts here.', 'wconvert'),
        'success_body' => __('We have received your request for the Sunday letter.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'night-sky-letter',
    'name' => __('Subscribe to night-sky notes', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'night-observatory',
    'business_types' => ['publishers'],
    'notes' => __('Use on astronomy articles. The moon and stars are graphic illustrations, not a date/location forecast. Configure the actual newsletter and use researched observing advice.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('THE NIGHT DESK', 'wconvert'),
            __('REQUEST RECEIVED', 'wconvert'),
        ],
        'headline' => [
            __('There is a whole
other world up there.', 'wconvert'),
            __('Look up a little more.', 'wconvert'),
        ],
        'body' => __('An occasional letter about the night sky, with simple things to notice and stories worth staying up for.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me the night-sky letter. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Send me the night-sky notes', 'wconvert'),
        'fine_print' => __('Occasional reading. Unsubscribe any time.', 'wconvert'),
        'success_headline' => __('A little more wonder.', 'wconvert'),
        'success_body' => __('Your request for the night-sky letter has been recorded.', 'wconvert'),
        'close_label' => __('Close', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

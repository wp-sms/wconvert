<?php

defined('ABSPATH') || exit;

return [
    'id' => 'weekend-observations',
    'name' => __('Request the weekend reading', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'weekend-broadsheet',
    'business_types' => ['publishers'],
    'notes' => __('Embed after an article. Replace the publication name and example editorial description; configure the weekly email destination and programme.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('INDEPENDENT NOTES', 'wconvert'),
            __('THE WEEKEND EDITION', 'wconvert'),
            __('THE LEAD STORY', 'wconvert'),
            __('IN EACH EDITION', 'wconvert'),
            __('A GOOD END TO THE WEEK', 'wconvert'),
            __('THE OBSERVANT / READER DESK', 'wconvert'),
        ],
        'headline' => [
            __('The Observant', 'wconvert'),
            __('The pleasure
of noticing.', 'wconvert'),
        ],
        'body' => [
            __('Small observations about the places, objects and rituals that shape a day.', 'wconvert'),
            __('01 One considered essay', 'wconvert'),
            __('02 Something worth keeping', 'wconvert'),
            __('03 A question to carry', 'wconvert'),
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the weekend letter', 'wconvert'),
        'consent_text' => __('Email me the weekend letter. I can unsubscribe anytime.', 'wconvert'),
        'fine_print' => __('Weekly reading, with an unsubscribe link in every email.', 'wconvert'),
        'success_headline' => __('Reader request received', 'wconvert'),
        'success_body' => __('Thank you. We have recorded your request for the weekend letter.', 'wconvert'),
        'close_label' => __('Close', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

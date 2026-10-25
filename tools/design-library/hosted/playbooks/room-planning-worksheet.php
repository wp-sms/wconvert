<?php

defined('ABSPATH') || exit;

return [
    'id' => 'room-planning-worksheet',
    'name' => __('Request a room-planning worksheet', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'room-checklist',
    'business_types' => ['publishers'],
    'notes' => __('Prepare the actual worksheet and email delivery destination. Target home-planning articles. This is a resource request, not personalised design advice.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('BEFORE YOU MOVE A THING', 'wconvert'),
            __('01', 'wconvert'),
            __('02', 'wconvert'),
            __('03', 'wconvert'),
            __('TAKE THE CHECKLIST', 'wconvert'),
            __('ROOM NOTES / REQUEST', 'wconvert'),
        ],
        'headline' => [
            __('Make room
for living.', 'wconvert'),
            __('Light', 'wconvert'),
            __('Movement', 'wconvert'),
            __('Scale', 'wconvert'),
            __('A plan you
can print.', 'wconvert'),
        ],
        'body' => [
            __('Watch the room at the time you use it.', 'wconvert'),
            __('Leave the routes you walk every day clear.', 'wconvert'),
            __('Measure the furniture, then the space around it.', 'wconvert'),
            __('Request the room-planning worksheet, with space for measurements and notes.', 'wconvert'),
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Use my email to send the room-planning worksheet.', 'wconvert'),
        'cta_label' => __('Request the worksheet', 'wconvert'),
        'fine_print' => __('One request. No marketing signup.', 'wconvert'),
        'success_headline' => __('Worksheet request received', 'wconvert'),
        'success_body' => __('Thank you. Your email has been recorded for the room-planning worksheet.', 'wconvert'),
        'close_label' => __('Close', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

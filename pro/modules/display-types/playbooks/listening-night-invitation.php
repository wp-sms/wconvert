<?php

defined('ABSPATH') || exit;

return [
    'id' => 'listening-night-invitation',
    'name' => __('Explore a listening night', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'after-hours',
    'business_types' => ['services'],
    'notes' => __('Link the real event page with dates, price, age/access restrictions and venue information. The record is illustrative, not an advertised performer or release. No booking is created.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('OFF THE RECORD / LISTENING NIGHTS', 'wconvert'),
        'headline' => [
            __('Good music.
Better company.', 'wconvert'),
            __('Come for the records.
Stay for the conversation.', 'wconvert'),
        ],
        'body' => [
            __('An evening for listening closely. Discover the records, the room and the people behind the selection.', 'wconvert'),
            __('Find the next date, venue and entry details.', 'wconvert'),
        ],
        'cta_label' => __('Explore the listening nights', 'wconvert'),
        'fine_print' => __('Opening the event page does not reserve a place.', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

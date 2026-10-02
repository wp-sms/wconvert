<?php

defined('ABSPATH') || exit;

return [
    'id' => 'event-calendar',
    'name' => __('Invite visitors to an open workshop', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'event-calendar',
    'business_types' => ['services'],
    'notes' => __('Replace the sample 14 November 2026 date, timezone and venue everywhere. Add a working event page with registration and access details. Set the campaign end before the event begins, in the site timezone. A click is not a registration.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('November 2026', 'wconvert'), __('Open workshop', 'wconvert'), __('When', 'wconvert'), __('Where', 'wconvert')],
        'headline' => __('See how a chair is restored.', 'wconvert'),
        'body' => [__('14', 'wconvert'), __('Saturday', 'wconvert'), __('Watch the tools and techniques, then ask your questions.', 'wconvert'), __('14 November 2026
14:00–16:00 Europe/London', 'wconvert'), __('The restoration workshop
In person', 'wconvert')],
        'cta_label' => __('View event details', 'wconvert'),
        'fine_print' => __('Check the venue, access and registration terms before planning your visit.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

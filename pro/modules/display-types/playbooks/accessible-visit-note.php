<?php

defined('ABSPATH') || exit;

return [
    'id' => 'accessible-visit-note',
    'name' => __('Find useful arrival information', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'availability-note',
    'business_types' => ['services'],
    'notes' => __('Link to verified entrance, parking, step-free route and facility details, with a contact route for individual questions. Show on relevant location or visit pages and exclude the information page itself. If access details are unknown, use an enquiry instead of making an accessibility claim. This setup records link clicks, not bookings.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Before your visit', 'wconvert'), __('Getting here', 'wconvert'), __('Access', 'wconvert')],
        'headline' => __('Plan your arrival.', 'wconvert'),
        'body' => [__('Find the entrance, parking and drop-off details.', 'wconvert'), __('Check step-free routes and facilities before your visit.', 'wconvert')],
        'cta_label' => __('Read arrival and access details', 'wconvert'),
        'fine_print' => __('Need more detail? Contact us before travelling.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

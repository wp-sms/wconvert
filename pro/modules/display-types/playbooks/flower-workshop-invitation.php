<?php

defined('ABSPATH') || exit;

return [
    'id' => 'flower-workshop-invitation',
    'name' => __('Explore flower workshops', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bloom-postcard',
    'business_types' => ['services'],
    'notes' => __('Replace the illustration if it misrepresents the workshop. Link actual dates, venue, access, prices and inclusions. Opening the link does not reserve a place.', 'wconvert-pro'),
    'copy' => [
        'headline' => __('A little wild.
All yours.', 'wconvert-pro'),
        'body' => __('Meet the flowers, learn a new skill and make an arrangement with your own point of view.', 'wconvert-pro'),
        'cta_label' => __('Explore flower workshops', 'wconvert-pro'),
        'fine_print' => __('See dates, prices and what is included before booking.', 'wconvert-pro'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

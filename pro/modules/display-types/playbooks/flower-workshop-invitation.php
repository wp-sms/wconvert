<?php

defined('ABSPATH') || exit;

return [
    'id' => 'flower-workshop-invitation',
    'name' => __('Explore flower workshops', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bloom-postcard',
    'business_types' => ['services'],
    'notes' => __('Replace the illustration if it misrepresents the workshop. Link actual dates, venue, access, prices and inclusions. Opening the link does not reserve a place.', 'wconvert'),
    'copy' => [
        'headline' => __('A little wild.
All yours.', 'wconvert'),
        'body' => __('Meet the flowers, learn a new skill and make an arrangement with your own point of view.', 'wconvert'),
        'cta_label' => __('Explore flower workshops', 'wconvert'),
        'fine_print' => __('See dates, prices and what is included before booking.', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'seasonal-service-link',
    'name' => __('Point visitors to seasonal service details', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'slide-in-nudge',
    'notes' => __('Link to an actual seasonal service page with prices, areas covered and availability. Edit the season for your location, set the campaign dates and target relevant service pages. This link does not book a service.', 'wconvert'),
    'copy' => [
        'headline' => __('Get the garden ready for spring', 'wconvert'),
        'cta_label' => __('View spring services', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
];

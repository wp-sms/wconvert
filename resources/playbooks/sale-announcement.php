<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'sale-announcement',
    'name' => __('Announce a sale', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'summer-archive',
    'notes' => __('A sale poster leading to one collection. Add your brand and set the button to your sale page. Match the 30% offer and exclusions to your prices. Set the actual start and end in Schedule and include the date and time zone in the copy; no deadline is invented for you.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('The summer edit', 'wconvert'),
        'headline' => __('Good days.
30% off.', 'wconvert'),
        'body' => __('Linen shirts. Easy shorts. Selected summer pieces, for less.', 'wconvert'),
        'cta_label' => __('Shop the summer sale', 'wconvert'),
        'fine_print' => __('Selected summer styles only. Prices as marked. No code needed.', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 8,
        ],
    ],
];

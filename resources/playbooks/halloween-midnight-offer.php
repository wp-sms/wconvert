<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'halloween-midnight-offer',
    'name' => __('Halloween midnight offer', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'halloween-engraved',
    'notes' => __('Show a Halloween offer in an illustrated print. Replace the sample discount, add a valid coupon and shop link, and set your campaign dates. No email is collected.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('THE OCTOBER EDIT', 'wconvert'),
        'headline' => __('A little dark.
A lot to love.', 'wconvert'),
        'body' => __('31% off the wonderfully unusual.', 'wconvert'),
        'cta_label' => __('Explore the Halloween edit', 'wconvert'),
        'fine_print' => __('Ends October 31. Selected items only.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

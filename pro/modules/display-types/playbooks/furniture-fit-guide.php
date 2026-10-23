<?php

defined('ABSPATH') || exit;

return [
    'id' => 'furniture-fit-guide',
    'name' => __('Help shoppers check furniture dimensions', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'split-notice',
    'business_types' => [
        'stores',
    ],
    'notes' => __('Show on furniture product pages and link to a useful measuring guide covering room dimensions, doorways and delivery access. Do not show on checkout or unrelated products. Opening the guide is not a purchase.', 'wconvert-pro'),
    'copy' => [
        'headline' => __('Not sure it will fit?', 'wconvert-pro'),
        'body' => __('Check dimensions and access before ordering.', 'wconvert-pro'),
        'cta_label' => __('See the measuring guide', 'wconvert-pro'),
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 20,
        ],
    ],
    'destination_hint' => [
        'types' => [],
        'fields' => [],
    ],
];

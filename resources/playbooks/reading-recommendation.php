<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'reading-recommendation',
    'name' => __('One more good read', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'reading-slip',
    'notes' => __('Place this compact reading slip beside or after a related article. Replace the title and description with a real recommendation and link the button to that article. It asks for no personal details and counts the click through to the reading destination.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Your next read', 'wconvert'),
        'headline' => __('Make room for a slower morning', 'wconvert'),
        'body' => __('A practical essay on finding a little quiet before the day begins.', 'wconvert'),
        'fine_print' => __('An essay to read at your own pace.', 'wconvert'),
        'cta_label' => __('Read the essay', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'page_load',
        ],
    ],
];

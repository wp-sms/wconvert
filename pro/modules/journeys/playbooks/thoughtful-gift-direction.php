<?php

defined('ABSPATH') || exit;

return [
    'id' => 'thoughtful-gift-direction',
    'name' => __('Find a thoughtful gift direction', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'gift-orbit',
    'business_types' => ['stores'],
    'notes' => __('Replace the illustrative suggestions with real curated collections and configure every result destination. This is an interest-based guide, not a product availability or suitability guarantee. No email is collected.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('LESS GUESSWORK. MORE “THAT IS SO THEM.”', 'wconvert'),
            __('A THOUGHTFUL STARTING POINT', 'wconvert'),
        ],
        'headline' => __('Find their
kind of lovely.', 'wconvert'),
        'next_label' => __('Show me a direction', 'wconvert'),
        'fine_print' => __('Just ideas. No email address needed.', 'wconvert'),
        'back_label' => __('Try another answer', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

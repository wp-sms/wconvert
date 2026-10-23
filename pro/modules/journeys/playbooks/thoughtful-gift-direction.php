<?php

defined('ABSPATH') || exit;

return [
    'id' => 'thoughtful-gift-direction',
    'name' => __('Find a thoughtful gift direction', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'gift-orbit',
    'business_types' => ['stores'],
    'notes' => __('Replace the illustrative suggestions with real curated collections and configure every result destination. This is an interest-based guide, not a product availability or suitability guarantee. No email is collected.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [
            __('LESS GUESSWORK. MORE “THAT IS SO THEM.”', 'wconvert-pro'),
            __('A THOUGHTFUL STARTING POINT', 'wconvert-pro'),
        ],
        'headline' => __('Find their
kind of lovely.', 'wconvert-pro'),
        'next_label' => __('Show me a direction', 'wconvert-pro'),
        'fine_print' => __('Just ideas. No email address needed.', 'wconvert-pro'),
        'back_label' => __('Try another answer', 'wconvert-pro'),
    ],
    'rules' => [[ 'type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

/**
 * "Show a message": opening hours or a holiday notice (ADR 0163).
 *
 * Prefill takes the design's counted link out. Only appearances are reported.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'show-message-opening-hours',
    'name' => __('Share opening hours', 'wconvert'),
    'goal' => 'show_message',
    'template_id' => 'reading-slip',
    'business_types' => ['stores', 'services'],
    'notes' => __('Tell visitors when you are open, or when you are closed for a holiday. Nothing to click or submit, so only appearances are reported.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Opening hours', 'wconvert'),
        'headline' => __('We are closed on Monday for the bank holiday.', 'wconvert'),
        'body' => __('Orders placed over the weekend will ship on Tuesday. Our team replies to messages from Tuesday morning.', 'wconvert'),
        'fine_print' => __('Normal hours: Monday to Friday, 9am to 5pm.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
];

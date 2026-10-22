<?php

/**
 * "Show a message": a notice with nothing to click or submit (ADR 0163).
 *
 * It names a click design, and prefill takes the counted link out, so the
 * merchant starts from the words alone. Only appearances are reported.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'show-message-free-shipping',
    'name' => __('Announce free shipping', 'wconvert'),
    'goal' => 'show_message',
    'template_id' => 'inline-benefits',
    'business_types' => ['stores'],
    'notes' => __('A short notice with no button and no form, in one column. Place the block near the top of your pages. Only appearances are reported, so there is no conversion rate. Add a Shop now button later if you want clicks counted.', 'wconvert'),
    'copy' => [
        'headline' => __('Free shipping all weekend', 'wconvert'),
        'body' => [
            __('Every order ships free', 'wconvert'),
            __('No code needed', 'wconvert'),
            __('Ends Sunday at midnight', 'wconvert'),
        ],
        'fine_print' => __('Applies to standard delivery.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
];

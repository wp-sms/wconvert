<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'new-batch-first-look',
    'name' => __('First look at each new batch', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'polaroid',
    'business_types' => ['stores'],
    'notes' => __('A corner card for makers who release small batches. Replace the photograph with your own work and email this list before each batch goes on sale. Connect your email service before publishing.', 'wconvert-pro'),
    'copy' => [
        'body' => [
            __('New from the kiln', 'wconvert-pro'),
            __('Thank you!', 'wconvert-pro'),
        ],
        'headline' => __('See each new batch
before it reaches the shop', 'wconvert-pro'),
        'email_label' => __('Email address', 'wconvert-pro'),
        'email_placeholder' => __('you@example.com', 'wconvert-pro'),
        'cta_label' => __('Show me first', 'wconvert-pro'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me about new batches. %s', 'wconvert-pro'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert-pro'),
            ],
        ],
        'success_headline' => __('Request received', 'wconvert-pro'),
        'success_body' => __('Your first-look request is in.', 'wconvert-pro'),
    ],
    'rules' => [
        ['type' => 'scroll_depth', 'percent' => 40],
    ],
    'destination_hint' => ['types' => ['email_service_provider'], 'fields' => ['email']],
];

<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'monthly-planting-letter',
    'name' => __('Monthly planting letter', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'field-guide',
    'business_types' => ['stores'],
    'notes' => __('A calm fullscreen invitation to a garden shop\'s monthly letter. Connect your email service and keep the letter monthly, as promised. Shows once a visitor has read half the page; exclude checkout.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Monthly planting notes', 'wconvert'),
        'headline' => __('What to sow
this month.', 'wconvert'),
        'body' => __('One short letter at the start of each month: what to sow, what to cut back and what to leave alone.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Send me the planting notes', 'wconvert'),
        'fine_print' => __('One letter a month. Unsubscribe whenever you like.', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me the monthly planting notes. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'success_headline' => __('Request received.', 'wconvert'),
        'success_body' => __('Thank you for asking for
the monthly planting notes.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'scroll_depth', 'percent' => 50],
    ],
    'destination_hint' => ['types' => ['wsms', 'email_service_provider'], 'fields' => ['email']],
];

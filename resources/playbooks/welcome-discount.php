<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'welcome-discount',
    'name' => __('Welcome discount', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'fieldwork',
    'notes' => __('A photo-led welcome offer with an on-screen code. Add your brand and photograph, create a valid 10% code, and enter it on the success screen. Match the exclusions to your offer and connect your email service for the monthly newsletter. Set targeting and frequency before publishing.', 'wconvert'),
    'copy' => [
        'headline' => __('10% off.
Room to grow.', 'wconvert'),
        'eyebrow' => __('A welcome from us', 'wconvert'),
        'body' => __('Get 10% off your first order and a monthly note with plant care and shop news.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me the monthly plant note and shop news. I can unsubscribe at any time. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'cta_label' => __('Join and reveal my code', 'wconvert'),
        'fine_print' => [
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('One email a month. Unsubscribe at any time. First order only; gift cards excluded. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
            __('Apply at checkout. First order only; gift cards excluded.', 'wconvert'),
        ],
        'success_headline' => __('A little more
green, for less.', 'wconvert'),
        'badge' => __('Request received', 'wconvert'),
        'success_body' => __('Your request is received. Use the code below for 10% off your first order.', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 8,
        ],
    ],
    'destination_hint' => [
        'types' => [
            'wsms',
            'email_service_provider',
        ],
        'fields' => [
            'email',
        ],
    ],
];

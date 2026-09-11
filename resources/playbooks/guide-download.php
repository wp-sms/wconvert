<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'guide-download',
    'name' => __('A useful little guide', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'useful-guide',
    'notes' => __('Show readers a preview of a seven-step plant-care guide. Replace the subject, cover copy and brand with your own resource, then add the file to a lead-magnet email destination. To offer an immediate download too, enable the success-screen link and set its URL. This goal counts successful email deliveries; the download link is an extra action.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('The plant-care guide', 'wconvert'),
            __('Start here', 'wconvert'),
        ],
        'headline' => [
            __('07', 'wconvert'),
            __('Less guesswork.
Happier plants.', 'wconvert'),
        ],
        'body' => [
            __('Simple checks.
Happier plants.', 'wconvert'),
            __('Seven checks for light, water and the little things your plants need.', 'wconvert'),
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me the plant-care guide. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'cta_label' => __('Request the plant-care guide', 'wconvert'),
        'fine_print' => [
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('One email with the guide. No newsletter subscription. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('Your details are used for this guide request. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
        ],
        'success_headline' => __('A useful first step.', 'wconvert'),
        'success_body' => [
            __('Thank you for requesting the plant-care guide.', 'wconvert'),
            __('Seven practical checks for happier plants.', 'wconvert'),
        ],
        'success_action' => __('Open the guide', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'scroll_depth',
            'percent' => 50,
        ],
    ],
    'destination_hint' => [
        'types' => [
            'lead_magnet_email',
        ],
        'fields' => [
            'email',
        ],
    ],
];

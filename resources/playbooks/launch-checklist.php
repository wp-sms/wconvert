<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'launch-checklist',
    'name' => __('Offer a website launch checklist', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'launch-checklist',
    'notes' => __('Offer a 12-point website launch checklist. Replace the brand and sample resource copy, then add the checklist to a lead-magnet email destination. To offer an immediate download too, enable the success-screen link and set its URL. Email acceptance by the site’s mail service is counted separately from submission; inbox arrival is not measured; the download link does not add a conversion.', 'wconvert'),
    'copy' => [
        'headline' => [
            __('12', 'wconvert'),
            __('Launch your site.
Keep your nerve.', 'wconvert'),
        ],
        'body' => [
            __('Checks before
you go live.', 'wconvert'),
            __('A twelve-point checklist for the details that are easy to miss before launch.', 'wconvert'),
        ],
        'eyebrow' => __('A practical pre-flight', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me the launch checklist. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'cta_label' => __('Request the launch checklist', 'wconvert'),
        'fine_print' => [
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('One checklist email. No marketing. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('We’ll use your details for this request. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
        ],
        'success_headline' => [
            __('Ready.', 'wconvert'),
            __('A clearer path
to launch.', 'wconvert'),
        ],
        'success_body' => [
            __('For your next launch.', 'wconvert'),
            __('We have received your request for the 12-point checklist.', 'wconvert'),
            __('Start with the forms, your smallest screen and the links that matter.', 'wconvert'),
        ],
        'success_action' => __('Open the checklist', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'scroll_depth',
            'percent' => 60,
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

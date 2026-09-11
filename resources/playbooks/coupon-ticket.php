<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'coupon-ticket',
    'name' => __('The welcome ticket', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'punched-ticket',
    'notes' => __('A bold first-order offer with a code to copy after submission. Add your brand, create a valid 15% code and enter it on the success screen. Match the restrictions to the offer and connect the monthly shop email in your chosen service. The code is revealed here; no delivery email is implied.', 'wconvert'),
    'copy' => [
        'headline' => __('15%', 'wconvert'),
        'body' => [
            __('Off your first order', 'wconvert'),
            __('Join our monthly shop email for new finds, useful things and a first-order code.', 'wconvert'),
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Send me the monthly shop email. I can unsubscribe at any time. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'cta_label' => __('Join and reveal 15% off', 'wconvert'),
        'fine_print' => [
            [
                /* translators: %s: the label of a link to the site's privacy policy. */
                'text' => __('Monthly shop emails. Unsubscribe at any time. Full-price items only; bundles excluded. %s', 'wconvert'),
                'link' => [
                    'label' => __('Privacy Policy', 'wconvert'),
                ],
            ],
            __('Use at checkout on full-price items. Excludes bundles.', 'wconvert'),
        ],
        'success_headline' => __('Good things
start here.', 'wconvert'),
        'success_body' => __('Your request is received. Your first-order code is below.', 'wconvert'),
        'eyebrow' => __('Your ticket to 15% off', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 12,
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

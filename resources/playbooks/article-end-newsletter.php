<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'article-end-newsletter',
    'name' => __('Newsletter signup after an article', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'inline-rule',
    'notes' => __('Place the WConvert block or shortcode at the foot of your posts. This stays in the page and asks only for an email address. Connect your email service and match the Thursday cadence to your publishing schedule before publishing.', 'wconvert'),
    'copy' => [
        'headline' => __('More like this, every Thursday', 'wconvert'),
        'body' => __('One email a week with the new posts and nothing else.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Send me the weekly round-up', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Send me the weekly round-up. I can unsubscribe at any time. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Unsubscribe at any time. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'success_headline' => __('Thanks for reading', 'wconvert'),
        'success_body' => __('We have received your request for the weekly round-up.', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'page_load',
        ],
    ],
    'targeting' => [
        'include' => [
            [
                'type' => 'singular',
                'value' => 'post',
            ],
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

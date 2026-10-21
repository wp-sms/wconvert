<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'early-access-launch',
    'name' => __('Early access to a new collection', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'lookbook',
    'business_types' => ['stores'],
    'notes' => __('An editorial spread for a fashion launch. Replace the photograph and the wordmark with your own, name the collection in the words, and email early-access requests the link a day before it opens. Connect your email service before publishing.', 'wconvert'),
    'copy' => [
        'headline' => __('The autumn edit,
a day early.', 'wconvert'),
        'body' => __('See the new collection a day before everyone else.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me collection news. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'cta_label' => __('Request early access', 'wconvert'),
        'success_headline' => __('Thank you.
Request received.', 'wconvert'),
        'success_body' => __('Your early-access request for
the autumn edit is in.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 8],
    ],
    'destination_hint' => ['types' => ['wsms', 'email_service_provider'], 'fields' => ['email']],
];

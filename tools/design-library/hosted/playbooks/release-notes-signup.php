<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'release-notes-signup',
    'name' => __('Release notes by email', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'changelog',
    'business_types' => ['services'],
    'notes' => __('For software and product teams: one email each time you ship. Connect your email service and send only when you release. Shows once a visitor has read half of a changelog or docs page.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('~/changelog', 'wconvert'),
            __('~/changelog', 'wconvert'),
        ],
        'headline' => __('Every release,
in one short email.', 'wconvert'),
        'body' => [
            __('+ what shipped', 'wconvert'),
            __('+ what changed, and why', 'wconvert'),
            __('+ one thing to try first', 'wconvert'),
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Subscribe ↵', 'wconvert'),
        'fine_print' => __('# One email per release.
# Unsubscribe any time.', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me release notes. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'success_headline' => __('$ request received', 'wconvert'),
        'success_body' => __('Thanks for asking for the release notes.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'scroll_depth', 'percent' => 50],
    ],
    'destination_hint' => ['types' => ['email_service_provider'], 'fields' => ['email']],
];

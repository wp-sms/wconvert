<?php

defined('ABSPATH') || exit;

return [
    'id' => 'edition-early-access',
    'name' => __('New collection early access', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'edition-pass',
    'notes' => __('Connect your email service and arrange the launch announcement there. Edit the release promise; this campaign does not send launch alerts automatically.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('The next edition', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => __('First look.
Your inbox.', 'wconvert'),
        'body' => __('A short email when a new collection arrives. No daily noise.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me new-collection announcements. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request first access', 'wconvert'),
        'fine_print' => __('Collection announcements only. Access and availability depend on the release.', 'wconvert'),
        'success_headline' => __('You’re on our request list.', 'wconvert'),
        'success_body' => __('We have received your request for collection announcements.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 15,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

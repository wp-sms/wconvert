<?php

defined('ABSPATH') || exit;

return [
    'id' => 'restock-announcements',
    'name' => __('Invite collection restock announcements', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'edition-pass',
    'business_types' => ['stores'],
    'notes' => __('Use for manually managed collection announcements. This is not a per-product stock alert: arrange the actual restock mailing before launch.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('Back in the making', 'wconvert'),
            __('Thank you', 'wconvert')
        ],
        'headline' => __('Another chance. When it returns.', 'wconvert'),
        'body' => __('Request occasional email news when pieces return to this collection.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me collection restock announcements. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request collection news', 'wconvert'),
        'fine_print' => __('Collection news only. No product reservation or automatic stock alert.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

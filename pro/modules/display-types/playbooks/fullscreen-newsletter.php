<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fullscreen-newsletter',
    'name' => __('Offer a weekly email in fullscreen', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'fullscreen-editorial',
    'notes' => __('Show a focused invitation after visitors have read half the page. Replace the sample promise and connect an audience service or choose Collect only. Review frequency and page targeting before publishing.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('The weekly field notes', 'wconvert'),
        'headline' => __("One useful idea.\nEvery Friday.", 'wconvert'),
        'body' => __('A short email on making space for better work. Read it in five minutes.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the weekly notes', 'wconvert'),
        'consent_text' => __('Email me the weekly field notes. I can unsubscribe anytime.', 'wconvert'),
        'fine_print' => ['text' => __('A short note every Friday. Unsubscribe anytime. %s', 'wconvert'), 'link' => ['label' => __('Privacy Policy', 'wconvert')]],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Your request for the weekly field notes has been received.', 'wconvert'),
    ],
    'rules' => [['type' => 'scroll_depth', 'percent' => 50]],
    'destination_hint' => ['types' => ['wsms', 'email_service_provider'], 'fields' => ['email']],
];

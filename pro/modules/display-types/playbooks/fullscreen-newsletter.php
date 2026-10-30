<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fullscreen-newsletter',
    'name' => __('Offer a weekly email in fullscreen', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'fullscreen-editorial',
    'notes' => __('Show a focused invitation after visitors have read half the page. Replace the sample promise and connect an audience service or choose Keep in WConvert only. Review frequency and page targeting before publishing.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => __('The weekly field notes', 'wconvert-pro'),
        'headline' => __("One useful idea.\nEvery Friday.", 'wconvert-pro'),
        'body' => __('A short email on making space for better work. Read it in five minutes.', 'wconvert-pro'),
        'email_label' => __('Email address', 'wconvert-pro'),
        'email_placeholder' => __('you@example.com', 'wconvert-pro'),
        'cta_label' => __('Request the weekly notes', 'wconvert-pro'),
        'consent_text' => __('Email me the weekly field notes. I can unsubscribe anytime.', 'wconvert-pro'),
        'fine_print' => ['text' => /* translators: %s: a link to the site's privacy policy. */ __('A short note every Friday. Unsubscribe anytime. %s', 'wconvert-pro'), 'link' => ['label' => __('Privacy Policy', 'wconvert-pro')]],
        'success_headline' => __('Request received', 'wconvert-pro'),
        'success_body' => __('Your request for the weekly field notes has been received.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'scroll_depth', 'percent' => 50]],
    'destination_hint' => ['types' => ['email_service_provider'], 'fields' => ['email']],
];

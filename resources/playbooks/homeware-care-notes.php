<?php

defined('ABSPATH') || exit;

return [
    'id' => 'homeware-care-notes',
    'name' => __('Monthly care notes for handmade homeware', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'product-shelf',
    'business_types' => [
        'stores',
    ],
    'notes' => __('Use on relevant homeware pages after reading. Publish accurate monthly care advice and connect an email service or choose Collect only. The illustration is reusable artwork; replace it if it misrepresents your products.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Made for everyday', 'wconvert'),
        'headline' => __('Care for the pieces you love.', 'wconvert'),
        'body' => __('A monthly note on looking after handmade homeware, from cleaning to careful storage.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me monthly care notes. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request care notes', 'wconvert'),
        'success_headline' => __('Your request is received.', 'wconvert'),
        'success_body' => __('Thank you for requesting monthly homeware care notes.', 'wconvert'),
    ],
    'rules' => [
        [
            'type' => 'time_on_page',
            'seconds' => 20,
        ],
    ],
    'destination_hint' => [
        'types' => [],
        'fields' => [
            'email',
        ],
    ],
];

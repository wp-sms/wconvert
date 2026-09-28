<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'product-care-guide',
    'name' => __('Offer a knitwear care guide', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'resource-index',
    'notes' => __('Create a guide matching these three care topics. Embed below knitwear care content and configure the lead-magnet email destination with the actual resource. Test email delivery separately from request acceptance.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('The care index', 'wconvert'), __('01', 'wconvert'), __('02', 'wconvert'), __('03', 'wconvert')],
        'headline' => __('Keep good things
for longer.', 'wconvert'),
        'body' => [__('A practical guide to looking after your knitwear.', 'wconvert'), __('Wash gently', 'wconvert'), __('Dry flat', 'wconvert'), __('Store well', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Send me the knitwear care guide I requested.', 'wconvert'),
        'cta_label' => __('Request the care guide', 'wconvert'),
        'fine_print' => __('One guide email. No newsletter signup.', 'wconvert'),
        'success_headline' => __('Care guide request received', 'wconvert'),
        'success_body' => __('Thank you for requesting the knitwear care guide.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => ['lead_magnet_email'],
        'fields' => ['email'],
    ],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'wholesale-enquiry',
    'name' => __('Ask about stocking a collection', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'service-docket',
    'notes' => __('Embed on a wholesale information page. Edit the enquiry choices and arrange who reviews requests. A submission does not approve a trade account or reveal trade pricing.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('For independent retailers', 'wconvert'), __('Thank you', 'wconvert')],
        'headline' => __('Good things.
New shelves.', 'wconvert'),
        'body' => __('Interested in stocking the collection? Tell us what you need to begin a trade conversation.', 'wconvert'),
        'fine_print' => [__('Trade eligibility and pricing are discussed separately.', 'wconvert'), __('We use your details to respond to this enquiry.', 'wconvert')],
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Your name', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'interest_label' => __('What do you need? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose an enquiry', 'wconvert'),
        'interest_options' => [
            'options' => [[
                    'value' => 'first-order',
                    'label' => __('First wholesale order', 'wconvert'),
                ], [
                    'value' => 'catalogue',
                    'label' => __('Trade catalogue', 'wconvert'),
                ], [
                    'value' => 'eligibility',
                    'label' => __('Trade eligibility', 'wconvert'),
                ]],
        ],
        'consent_text' => __('Contact me about this wholesale enquiry.', 'wconvert'),
        'cta_label' => __('Send a trade enquiry', 'wconvert'),
        'success_headline' => __('Trade enquiry received', 'wconvert'),
        'success_body' => __('Thank you. This request does not open or approve a trade account.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

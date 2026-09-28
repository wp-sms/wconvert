<?php

defined('ABSPATH') || exit;

return [
    'id' => 'accounting-consultation',
    'name' => __('Ask about small-business accounting support', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'portrait-frame',
    'business_types' => ['services'],
    'notes' => __('Offer a first conversation rather than financial advice. Collect no tax identifiers, balances or documents in this initial form.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('For small businesses', 'wconvert'), __('Next steps', 'wconvert')],
        'headline' => __('Make room for the work you do.', 'wconvert'),
        'body' => __('Request a conversation about bookkeeping and the support your business needs.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Reply to my accounting support enquiry.', 'wconvert'),
        'cta_label' => __('Request a conversation', 'wconvert'),
        'fine_print' => __('We use your details to respond to this request. No appointment is confirmed.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

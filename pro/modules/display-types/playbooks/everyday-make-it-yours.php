<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-make-it-yours',
    'name' => __('Make it yours', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'everyday-make-it-yours',
    'notes' => __('Choose where requests are collected and how your team will reply. Place the campaign using its block or shortcode.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Monogram studio', 'wconvert-pro'), __('Made personal', 'wconvert-pro'), __('Monogram studio', 'wconvert-pro'), __('Made personal', 'wconvert-pro')], 'headline' => [__('Aa', 'wconvert-pro'), __('A little more you.', 'wconvert-pro'), __('Aa', 'wconvert-pro')], 'body' => [['text' => __('A personal touch.
A piece to keep.', 'wconvert-pro')], ['text' => __('Tell our studio you are interested in personalisation. We’ll use your details to discuss the options.', 'wconvert-pro')], ['text' => __('A personal touch.
A piece to keep.', 'wconvert-pro')]], 'name_label' => __('Your name', 'wconvert-pro'), 'name_placeholder' => __('Your name', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Ask about personalisation', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => ['text' => __('We use these details to respond to your request.', 'wconvert-pro')], 'success_headline' => __('Your enquiry is received.', 'wconvert-pro'), 'success_body' => ['text' => __('Thank you for asking about personalisation. The studio has your request.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

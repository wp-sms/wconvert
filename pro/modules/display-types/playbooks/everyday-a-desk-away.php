<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-a-desk-away',
    'name' => __('A desk away', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'everyday-a-desk-away',
    'notes' => __('Choose where requests are collected and how your team will reply. Place the campaign using its block or shortcode.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Neighbourhood workspace', 'wconvert-pro'), __('A little room to focus', 'wconvert-pro'), __('Neighbourhood workspace', 'wconvert-pro'), __('A little room to focus', 'wconvert-pro')], 'headline' => __('Your work.
A different setting.', 'wconvert-pro'), 'body' => ['text' => __('Ask about a day in our shared studio. Find out about desks, facilities and current availability.', 'wconvert-pro')], 'name_label' => __('Your name', 'wconvert-pro'), 'name_placeholder' => __('Your name', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Ask about a studio day', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => ['text' => __('We use these details to respond to your request.', 'wconvert-pro')], 'success_headline' => __('Your studio-day enquiry is received.', 'wconvert-pro'), 'success_body' => ['text' => __('Thanks for your interest. A desk has not been reserved by this request.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

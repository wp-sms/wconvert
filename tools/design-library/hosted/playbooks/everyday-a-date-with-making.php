<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-a-date-with-making',
    'name' => __('A date with making', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'everyday-a-date-with-making',
    'notes' => __('Choose where requests are collected and how your team will reply. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('November', 'wconvert'), __('Make something with your hands', 'wconvert'), __('Clay club / introductory workshop', 'wconvert'), __('November', 'wconvert'), __('Make something with your hands', 'wconvert'), __('Clay club / introductory workshop', 'wconvert')], 'headline' => [__('14', 'wconvert'), __('A morning
well spent.', 'wconvert'), __('14', 'wconvert')], 'body' => [['text' => __('Saturday · 10:00–12:00', 'wconvert')], ['text' => __('Ask for details of our beginner pottery workshop. We’ll use your email to respond with availability and booking information.', 'wconvert')], ['text' => __('Saturday · 10:00–12:00', 'wconvert')]], 'name_label' => __('Your name', 'wconvert'), 'name_placeholder' => __('Your name', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Request workshop details', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'fine_print' => ['text' => __('We use these details to respond to your request.', 'wconvert')], 'success_headline' => __('Your workshop enquiry is received.', 'wconvert'), 'success_body' => ['text' => __('Thanks for your interest. This request does not reserve a workshop place.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

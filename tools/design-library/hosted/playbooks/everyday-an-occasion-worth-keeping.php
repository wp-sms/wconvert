<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-an-occasion-worth-keeping',
    'name' => __('An occasion worth keeping', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'everyday-an-occasion-worth-keeping',
    'notes' => __('Choose where requests are collected and how your team will reply. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('Wild stem / event flowers', 'wconvert'), __('Wild stem / event flowers', 'wconvert')], 'headline' => __('For the days
you’ll remember.', 'wconvert'), 'body' => ['text' => __('Thoughtful flowers for gatherings, celebrations and everything in between. Ask our studio about your occasion.', 'wconvert')], 'name_label' => __('Your name', 'wconvert'), 'name_placeholder' => __('Your name', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Enquire about event flowers', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'fine_print' => ['text' => __('We use these details to respond to your request.', 'wconvert')], 'success_headline' => __('Your flower enquiry is received.', 'wconvert'), 'success_body' => ['text' => __('Thank you for considering the studio for your occasion.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

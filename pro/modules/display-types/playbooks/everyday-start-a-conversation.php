<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-start-a-conversation',
    'name' => __('Start a conversation', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'everyday-start-a-conversation',
    'notes' => __('Choose where requests are collected and how your team will reply.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Goodwork / independent design studio', 'wconvert-pro'), __('Goodwork / independent design studio', 'wconvert-pro')], 'headline' => __('Tell us what
you have in mind.', 'wconvert-pro'), 'body' => ['text' => __('A new website? A better identity? A small idea you want to explore? Start with the kind of help you need.', 'wconvert-pro')], 'interest_label' => __('What would you like help with?', 'wconvert-pro'), 'interest_placeholder' => __('Choose an option', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'website', 'label' => __('A website', 'wconvert-pro')], ['value' => 'identity', 'label' => __('A visual identity', 'wconvert-pro')], ['value' => 'exploring', 'label' => __('I’m still exploring', 'wconvert-pro')]]], 'name_label' => __('Your name', 'wconvert-pro'), 'name_placeholder' => __('Your name', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Start the conversation', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => ['text' => __('We use these details to respond to your request.', 'wconvert-pro')], 'success_headline' => __('A good conversation starts here.', 'wconvert-pro'), 'success_body' => ['text' => __('Your enquiry is received. The studio has your details and area of interest.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

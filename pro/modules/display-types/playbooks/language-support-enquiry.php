<?php

defined('ABSPATH') || exit;

return [
    'id' => 'language-support-enquiry',
    'name' => __('Ask about language support', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['services'],
    'notes' => __('Use on contact and consultation pages. Verify available languages, costs and interpreter arrangements before confirming support.', 'wconvert-pro'),
    'copy' => ['headline' => __('A clearer conversation.', 'wconvert-pro'), 'body' => __('Ask about the language support available for a first meeting. We will reply by email.', 'wconvert-pro'), 'interest_label' => __('Which support? (optional)', 'wconvert-pro'), 'interest_placeholder' => __('Choose a topic', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('An interpreter', 'wconvert-pro')], ['value' => 'option-2', 'label' => __('Written information', 'wconvert-pro')], ['value' => 'option-3', 'label' => __('Help choosing an option', 'wconvert-pro')]]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert-pro'), 'cta_label' => __('Ask about language support', 'wconvert-pro'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

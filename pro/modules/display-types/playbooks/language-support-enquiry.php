<?php

defined('ABSPATH') || exit;

return [
    'id' => 'language-support-enquiry',
    'name' => __('Ask about language support', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['services'],
    'notes' => __('Use on contact and consultation pages. Verify available languages, costs and interpreter arrangements before confirming support.', 'wconvert'),
    'copy' => ['headline' => __('A clearer conversation.', 'wconvert'), 'body' => __('Ask about the language support available for a first meeting. We will reply by email.', 'wconvert'), 'interest_label' => __('Which support? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose a topic', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('An interpreter', 'wconvert')], ['value' => 'option-2', 'label' => __('Written information', 'wconvert')], ['value' => 'option-3', 'label' => __('Help choosing an option', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Ask about language support', 'wconvert'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

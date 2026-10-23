<?php

defined('ABSPATH') || exit;

return [
    'id' => 'assembly-guidance',
    'name' => __('Request assembly guidance', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['stores'],
    'notes' => __('Show beside assembly resources. Ask for the product model during follow-up. Do not provide safety-critical repair instructions in the template.', 'wconvert-pro'),
    'copy' => ['headline' => __('A little help putting it together?', 'wconvert-pro'), 'body' => __('Tell us where you need guidance. We will reply by email.', 'wconvert-pro'), 'interest_label' => __('What would help? (optional)', 'wconvert-pro'), 'interest_placeholder' => __('Choose a topic', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Finding the instructions', 'wconvert-pro')], ['value' => 'option-2', 'label' => __('Checking a supplied part', 'wconvert-pro')], ['value' => 'option-3', 'label' => __('Understanding a step', 'wconvert-pro')]]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert-pro'), 'cta_label' => __('Request assembly help', 'wconvert-pro'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

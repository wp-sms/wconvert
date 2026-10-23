<?php

defined('ABSPATH') || exit;

return [
    'id' => 'spare-parts-advice',
    'name' => __('Ask about a replacement part', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['stores'],
    'notes' => __('Place on spare-parts pages. Follow up for model numbers and photographs; the form does not identify a compatible part or reserve stock.', 'wconvert-pro'),
    'copy' => ['headline' => __('Keep a useful thing working.', 'wconvert-pro'), 'body' => __('Choose the kind of part you need. We will reply to discuss the item and compatibility.', 'wconvert-pro'), 'interest_label' => __('Which part? (optional)', 'wconvert-pro'), 'interest_placeholder' => __('Choose a topic', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('A fixing or fastener', 'wconvert-pro')], ['value' => 'option-2', 'label' => __('A removable component', 'wconvert-pro')], ['value' => 'option-3', 'label' => __('Help identifying a part', 'wconvert-pro')]]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert-pro'), 'cta_label' => __('Ask about a part', 'wconvert-pro'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

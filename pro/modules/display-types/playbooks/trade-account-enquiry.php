<?php

defined('ABSPATH') || exit;

return [
    'id' => 'trade-account-enquiry',
    'name' => __('Ask about buying for a business', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['stores'],
    'notes' => __('Use on trade information pages. Follow up for business details and eligibility. No account, credit approval or trade price is granted here.', 'wconvert'),
    'copy' => ['headline' => __('Buying for your business?', 'wconvert'), 'body' => __('Choose the kind of business purchase you are considering. We will reply with the next steps.', 'wconvert'), 'interest_label' => __('What are you planning? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose a topic', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Regular stock purchases', 'wconvert')], ['value' => 'option-2', 'label' => __('Products for a workspace', 'wconvert')], ['value' => 'option-3', 'label' => __('A one-off business order', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Discuss trade buying', 'wconvert'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

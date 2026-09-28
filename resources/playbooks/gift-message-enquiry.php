<?php

defined('ABSPATH') || exit;

return [
    'id' => 'gift-message-enquiry',
    'name' => __('Ask about a personalised gift message', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['stores'],
    'notes' => __('Show on personalisation pages. Collect the exact message through the order process or follow-up, not this category field. No order is changed here.', 'wconvert'),
    'copy' => ['eyebrow' => __('Start with a conversation', 'wconvert'), 'headline' => __('A few words, thoughtfully presented.', 'wconvert'), 'body' => __('Ask about the message formats available for a gift. We will reply with the details.', 'wconvert'), 'interest_label' => __('Which format interests you? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose an option', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('A printed message card', 'wconvert')], ['value' => 'option-2', 'label' => __('A handwritten note', 'wconvert')], ['value' => 'option-3', 'label' => __('Help choosing a format', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Ask about a gift message', 'wconvert'), 'fine_print' => __('A request to discuss the next step. No booking or purchase.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request and the topic you selected.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

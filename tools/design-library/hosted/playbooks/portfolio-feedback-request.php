<?php

defined('ABSPATH') || exit;

return [
    'id' => 'portfolio-feedback-request',
    'name' => __('Ask about a portfolio feedback session', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['services'],
    'notes' => __('Target portfolio-review pages. Agree fees, confidentiality and file-sharing arrangements in follow-up. This form uploads no work.', 'wconvert'),
    'copy' => ['eyebrow' => __('Start with a conversation', 'wconvert'), 'headline' => __('A fresh pair of eyes.', 'wconvert'), 'body' => __('Ask about a feedback session for your work. We will reply to discuss scope and format.', 'wconvert'), 'interest_label' => __('What kind of portfolio? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose an option', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Design work', 'wconvert')], ['value' => 'option-2', 'label' => __('Photography', 'wconvert')], ['value' => 'option-3', 'label' => __('Writing samples', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Discuss portfolio feedback', 'wconvert'), 'fine_print' => __('A request to discuss the next step. No booking or purchase.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request and the topic you selected.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

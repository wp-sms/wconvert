<?php

defined('ABSPATH') || exit;

return [
    'id' => 'remote-walkthrough-request',
    'name' => __('Request a remote project walkthrough', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['services'],
    'notes' => __('Show on remote assessment pages. Agree a time and suitable video method in follow-up; no assessment or price is confirmed.', 'wconvert'),
    'copy' => ['eyebrow' => __('Start with a conversation', 'wconvert'), 'headline' => __('Show us the space, from where you are.', 'wconvert'), 'body' => __('Discuss whether a video walkthrough is a useful first step for your project.', 'wconvert'), 'interest_label' => __('What would you like to show? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose an option', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('A room or interior', 'wconvert')], ['value' => 'option-2', 'label' => __('An outdoor space', 'wconvert')], ['value' => 'option-3', 'label' => __('Help choosing a starting point', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Discuss a walkthrough', 'wconvert'), 'fine_print' => __('A request to discuss the next step. No booking or purchase.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request and the topic you selected.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

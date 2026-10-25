<?php

defined('ABSPATH') || exit;

return [
    'id' => 'translation-project-enquiry',
    'name' => __('Start a translation project enquiry', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['services'],
    'notes' => __('Use on translation pages. Follow up for languages, word count, deadline and confidentiality; do not collect documents or promise certified translation here.', 'wconvert'),
    'copy' => ['eyebrow' => __('Start with a conversation', 'wconvert'), 'headline' => __('Make the brief clear first.', 'wconvert'), 'body' => __('Tell us the type of material you need translated. We will reply to discuss languages and scope.', 'wconvert'), 'interest_label' => __('What kind of material? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose an option', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Website content', 'wconvert')], ['value' => 'option-2', 'label' => __('Product information', 'wconvert')], ['value' => 'option-3', 'label' => __('General business documents', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Discuss translation', 'wconvert'), 'fine_print' => __('A request to discuss the next step. No booking or purchase.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request and the topic you selected.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

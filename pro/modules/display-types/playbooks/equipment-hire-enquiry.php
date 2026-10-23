<?php

defined('ABSPATH') || exit;

return [
    'id' => 'equipment-hire-enquiry',
    'name' => __('Ask about equipment hire', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['services'],
    'notes' => __('Use on hire catalogue pages. Follow up for dates, specifications, collection and deposit terms. No equipment is reserved here.', 'wconvert-pro'),
    'copy' => ['headline' => __('The right kit for the job.', 'wconvert-pro'), 'body' => __('Tell us the kind of hire you are considering. We will reply to discuss dates and requirements.', 'wconvert-pro'), 'interest_label' => __('What do you need? (optional)', 'wconvert-pro'), 'interest_placeholder' => __('Choose a topic', 'wconvert-pro'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Presentation equipment', 'wconvert-pro')], ['value' => 'option-2', 'label' => __('Workshop equipment', 'wconvert-pro')], ['value' => 'option-3', 'label' => __('Help choosing equipment', 'wconvert-pro')]]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert-pro'), 'cta_label' => __('Discuss equipment hire', 'wconvert-pro'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert-pro'), 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

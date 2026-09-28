<?php

defined('ABSPATH') || exit;

return [
    'id' => 'equipment-hire-enquiry',
    'name' => __('Ask about equipment hire', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'slide-in-question',
    'business_types' => ['services'],
    'notes' => __('Use on hire catalogue pages. Follow up for dates, specifications, collection and deposit terms. No equipment is reserved here.', 'wconvert'),
    'copy' => ['headline' => __('The right kit for the job.', 'wconvert'), 'body' => __('Tell us the kind of hire you are considering. We will reply to discuss dates and requirements.', 'wconvert'), 'interest_label' => __('What do you need? (optional)', 'wconvert'), 'interest_placeholder' => __('Choose a topic', 'wconvert'), 'interest_options' => ['options' => [['value' => 'option-1', 'label' => __('Presentation equipment', 'wconvert')], ['value' => 'option-2', 'label' => __('Workshop equipment', 'wconvert')], ['value' => 'option-3', 'label' => __('Help choosing equipment', 'wconvert')]]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Use my details to respond to this request.', 'wconvert'), 'cta_label' => __('Discuss equipment hire', 'wconvert'), 'fine_print' => __('We use your email to respond to this request.', 'wconvert'), 'success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request. Arrangements still need to be agreed.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

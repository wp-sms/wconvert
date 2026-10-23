<?php

defined('ABSPATH') || exit;

return [
    'id' => 'callback-slip',
    'name' => __('Discuss a repair by phone', 'wconvert-pro'),
    'goal' => 'collect_enquiries',
    'template_id' => 'callback-slip',
    'business_types' => ['services'],
    'notes' => __('Show on relevant repair pages. Assign someone to follow up from Leads or export, confirm service coverage and use the native phone country selector. This requests a call; it does not book a time or authorise marketing.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('Repair advice', 'wconvert-pro'), __('What happens next', 'wconvert-pro'), __('Request received', 'wconvert-pro')],
        'headline' => __('Talk through a repair.', 'wconvert-pro'),
        'body' => [__('Leave a number to discuss what needs fixing.', 'wconvert-pro'), __('We will discuss the repair before agreeing any work.', 'wconvert-pro')],
        'phone_label' => __('Phone number', 'wconvert-pro'),
        'phone_placeholder' => __('+44 7700 900123', 'wconvert-pro'),
        'consent_text' => __('Call me about this repair request.', 'wconvert-pro'),
        'cta_label' => __('Request a call', 'wconvert-pro'),
        'fine_print' => __('For this enquiry only. No marketing signup.', 'wconvert-pro'),
        'success_headline' => __('Your call request is received.', 'wconvert-pro'),
        'success_body' => __('Thank you. The repair and a suitable time still need to be discussed.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['phone']],
];

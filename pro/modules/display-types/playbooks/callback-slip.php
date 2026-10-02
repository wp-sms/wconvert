<?php

defined('ABSPATH') || exit;

return [
    'id' => 'callback-slip',
    'name' => __('Discuss a repair by phone', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'callback-slip',
    'business_types' => ['services'],
    'notes' => __('Show on relevant repair pages. Assign someone to follow up from Leads or export, confirm service coverage and use the native phone country selector. This requests a call; it does not book a time or authorise marketing.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Repair advice', 'wconvert'), __('What happens next', 'wconvert'), __('Request received', 'wconvert')],
        'headline' => __('Talk through a repair.', 'wconvert'),
        'body' => [__('Leave a number to discuss what needs fixing.', 'wconvert'), __('We will discuss the repair before agreeing any work.', 'wconvert')],
        'phone_label' => __('Phone number', 'wconvert'),
        'phone_placeholder' => __('+44 7700 900123', 'wconvert'),
        'consent_text' => __('Call me about this repair request.', 'wconvert'),
        'cta_label' => __('Request a call', 'wconvert'),
        'fine_print' => __('For this enquiry only. No marketing signup.', 'wconvert'),
        'success_headline' => __('Your call request is received.', 'wconvert'),
        'success_body' => __('Thank you. The repair and a suitable time still need to be discussed.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['phone']],
];

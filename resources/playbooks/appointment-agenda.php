<?php

defined('ABSPATH') || exit;

return [
    'id' => 'appointment-agenda',
    'name' => __('Request a room-planning consultation', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-agenda',
    'business_types' => ['services'],
    'notes' => __('Replace the consultation agenda with your actual service. Keep the topic optional, name who follows up, and agree any fees, format and appointment time separately. Review the chosen topic in Leads or export; not all destinations forward it.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Before we arrange a time', 'wconvert'), __('Bring to the conversation', 'wconvert'), __('Agree together', 'wconvert'), __('Request received', 'wconvert')],
        'headline' => [__('Talk through your space.', 'wconvert'), __('Your enquiry', 'wconvert')],
        'body' => [__('Ask about a planning consultation.', 'wconvert'), __('Your room and the changes you have in mind.', 'wconvert'), __('The format, any fee and a suitable time.', 'wconvert')],
        'interest_label' => __('What would help? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a topic', 'wconvert'),
        'interest_options' => ['options' => [['value' => 'layout', 'label' => __('Planning the layout', 'wconvert')], ['value' => 'colour', 'label' => __('Choosing colours and materials', 'wconvert')], ['value' => 'unsure', 'label' => __('Help deciding where to start', 'wconvert')]]],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Reply to my consultation enquiry.', 'wconvert'),
        'cta_label' => __('Ask about a consultation', 'wconvert'),
        'fine_print' => __('Your details are for this enquiry. A time is not reserved.', 'wconvert'),
        'success_headline' => __('Consultation enquiry received', 'wconvert'),
        'success_body' => __('Thank you. The format, any fee and a suitable time still need to be agreed.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

<?php

/** Capture a request for a consultation; scheduling happens after the enquiry. */

defined('ABSPATH') || exit;

return [
    'id' => 'consultation-invitation',
    'name' => __('Request a consultation', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'name-and-email',
    'notes' => __('Target your service pages and describe what your consultation covers. This form captures a request with an email address. Review requests in Leads or connect your receiving service, then arrange a time with the visitor. WConvert counts requests, not booked appointments.', 'wconvert'),
    'copy' => [
        'headline' => __('Find the next step for your project', 'wconvert'),
        'body' => __('A first conversation about what you need, what is possible and whether we can help.', 'wconvert'),
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Alex Morgan', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request a consultation', 'wconvert'),
        'fine_print' => __('We use your details to respond to this enquiry. Sending a request does not book an appointment.', 'wconvert'),
        'consent_text' => __('You may contact me about my consultation request.', 'wconvert'),
        'success_headline' => __('Consultation request received', 'wconvert'),
        'success_body' => __('Thank you for getting in touch. We have received your details and your request for a conversation.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 20],
    ],
];

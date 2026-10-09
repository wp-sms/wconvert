<?php

defined('ABSPATH') || exit;

return [
    'id' => 'product-advice-request',
    'name' => __('Let shoppers ask for product advice', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-choice',
    'business_types' => ['stores'],
    'notes' => __('Embed on the relevant product page and tailor the choices to that product. Assign a person to reply; this form does not reserve stock.', 'wconvert'),
    'copy' => [
        'headline' => __('A little help choosing?', 'wconvert'),
        'body' => __('Tell us which detail you need help with. We will use your email to reply.', 'wconvert'),
        'name_label' => __('Your name (optional)', 'wconvert'),
        'name_placeholder' => __('Alex Morgan', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'interest_label' => __('What would help? (optional)', 'wconvert'),
        'interest_placeholder' => __('Choose a topic', 'wconvert'),
        'interest_options' => [
            'options' => [
                [
                    'value' => 'dimensions',
                    'label' => __('Dimensions and fit', 'wconvert')
                ],
                [
                    'value' => 'materials',
                    'label' => __('Materials and care', 'wconvert')
                ],
                [
                    'value' => 'availability',
                    'label' => __('Availability', 'wconvert')
                ]
            ]
        ],
        'cta_label' => __('Request product advice', 'wconvert'),
        'consent_text' => __('Use my details to reply to this product enquiry.', 'wconvert'),
        'fine_print' => __('We use your details to respond to this request. No appointment is confirmed.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request.', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

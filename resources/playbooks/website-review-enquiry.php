<?php

defined('ABSPATH') || exit;

return [
    'id' => 'website-review-enquiry',
    'name' => __('Invite a website review enquiry', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'service-summary',
    'business_types' => ['services'],
    'notes' => __('Describe the review you actually offer, show on relevant service pages and choose a monitored enquiry workflow or Collect only. No review is booked here.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Website review', 'wconvert'), __('01 / Clarity', 'wconvert'), __('02 / Usability', 'wconvert')],
        'headline' => __('Find the friction in your website.', 'wconvert'),
        'body' => [__('A focused review of the pages your customers use most.', 'wconvert'), __('Can visitors find the answer?', 'wconvert'), __('Can they take the next step?', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Ask about a review', 'wconvert'),
        'fine_print' => __('We use your email to discuss scope and pricing. This does not book a review.', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Your website review enquiry is received. Scope, pricing and timing are agreed separately.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 20,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];

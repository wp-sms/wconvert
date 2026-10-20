<?php

defined('ABSPATH') || exit;

return [
    'id' => 'slower-outdoor-guide',
    'name' => __('Request a slower outdoor guide', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'trail-window',
    'business_types' => ['publishers'],
    'notes' => __('Prepare the actual guide and delivery destination. The landscape is fictional and is not a route recommendation. Replace safety and access advice with researched local information.', 'wconvert'),
    'copy' => [
        'screens' => [
            'screen:invitation' => [
                'headline' => __('Take the
scenic route.', 'wconvert'),
                'body' => __('A small guide to planning a slower day outdoors: what to bring, what to notice and how to leave less behind.', 'wconvert'),
                'next_label' => __('I would like the guide', 'wconvert'),
            ],
            'submission:email' => [
                'eyebrow' => __('A LITTLE MORE OUTSIDE', 'wconvert'),
                'headline' => __('Make space
for a slower day.', 'wconvert'),
                'body' => __('Where should we send your guide request?', 'wconvert'),
                'email_label' => __('Email address', 'wconvert'),
                'email_placeholder' => __('you@example.com', 'wconvert'),
                'cta_label' => __('Request the outdoor guide', 'wconvert'),
                'back_label' => __('Back to the invitation', 'wconvert'),
                'fine_print' => __('One guide request. No newsletter signup.', 'wconvert'),
            ],
            'acknowledgement' => [
                'eyebrow' => __('REQUEST RECEIVED', 'wconvert'),
                'success_headline' => __('Your next chapter: outside.', 'wconvert'),
                'success_body' => __('Your email has been recorded for the outdoor guide request.', 'wconvert'),
                'close_label' => __('Close', 'wconvert'),
            ],
        ],
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

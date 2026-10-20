<?php

defined('ABSPATH') || exit;

return [
    'id' => 'seasonal-sunshine',
    'name' => __('Request seasonal shop news', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'citrus-sunrise',
    'business_types' => ['stores'],
    'notes' => __('Replace the illustrative oranges if they do not represent your shop. Configure a real seasonal email programme and its delivery destination. No discount or delivery is promised.', 'wconvert'),
    'copy' => [
        'headline' => __('A little
sunshine
in your inbox.', 'wconvert'),
        'body' => __('Fresh seasonal picks. Occasional shop news. Something worth opening.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me seasonal shop news. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Bring on the good stuff', 'wconvert'),
        'fine_print' => __('Occasional emails. Unsubscribe whenever you like.', 'wconvert'),
        'eyebrow' => __('THANK YOU', 'wconvert'),
        'success_headline' => __('A brighter inbox starts here.', 'wconvert'),
        'success_body' => __('Your request for seasonal shop news has been recorded.', 'wconvert'),
        'close_label' => __('Close', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

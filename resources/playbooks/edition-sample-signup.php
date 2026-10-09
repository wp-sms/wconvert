<?php

defined('ABSPATH') || exit;

return [
    'id' => 'edition-sample-signup',
    'name' => __('Read a sample of the weekly letter', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'excerpt-window',
    'business_types' => ['publishers'],
    'notes' => __('Embed after a relevant article. Replace the sample with your own writing and state your real topic and cadence. Configure an email destination or keep leads in WConvert only; this is a recurring newsletter request, not resource delivery. Keep the optional resource follow-up hidden. A saved request does not confirm subscription or inbox delivery.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A sample from the weekly letter', 'wconvert'), __('The Small Hours letter', 'wconvert')],
        'headline' => [__('Leave a little room to notice.', 'wconvert'), __('A thoughtful note, once a week.', 'wconvert')],
        'body' => [__('The best part of a familiar walk is often the thing you almost miss: a changed window, a new leaf, a neighbour taking a different route.', 'wconvert'), __('Try leaving the headphones at home for the first five minutes. Give one ordinary detail your full attention.', 'wconvert'), __('Short observations and one small idea to try. Read this sample before deciding whether to request future editions.', 'wconvert')],
        'fine_print' => [__('Original sample writing for the Small Hours letter.', 'wconvert'), __('You can unsubscribe from future editions at any time.', 'wconvert')],
        'consent_text' => __('Email me the weekly Small Hours letter. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request the weekly letter', 'wconvert'),
        'success_headline' => __('Your request is received.', 'wconvert'),
        'success_body' => __('Thank you. We have received your request for the Small Hours letter.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

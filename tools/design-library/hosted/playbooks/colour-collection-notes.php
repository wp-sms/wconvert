<?php

defined('ABSPATH') || exit;

return [
    'id' => 'colour-collection-notes',
    'name' => __('Get new colour collection notes', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'colour-atlas',
    'business_types' => ['stores'],
    'notes' => __('Use on collection pages. Replace the illustrative colours with the actual range and connect email delivery. Screen colours are illustrative, not an accurate physical match.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('PALETTE STUDIES', 'wconvert'),
            __('01 / CHALK', 'wconvert'),
            __('02 / CLAY', 'wconvert'),
            __('03 / INK', 'wconvert'),
            __('PALETTE STUDIES / REQUEST', 'wconvert'),
        ],
        'headline' => __('Find your
quiet colour.', 'wconvert'),
        'body' => [
            __('A softer starting point.', 'wconvert'),
            __('Warmth without the noise.', 'wconvert'),
            __('The finishing note.', 'wconvert'),
            __('First news of our next colour collection. Occasional email, with a useful look at the materials.', 'wconvert'),
        ],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me new colour collection notes. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Request colour notes', 'wconvert'),
        'success_headline' => __('Colour note request received', 'wconvert'),
        'success_body' => __('Thank you. We have recorded your request for collection notes.', 'wconvert'),
        'close_label' => __('Close', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];

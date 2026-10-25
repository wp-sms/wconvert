<?php

defined('ABSPATH') || exit;

return [
    'id' => 'workshop-programme',
    'name' => __('Explore the workshop programme', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'programme-board',
    'business_types' => ['services'],
    'notes' => __('Replace the sample programme with actual times and add the booking page. Use on workshop pages; no booking or payment happens in this campaign.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('SATURDAY / SAMPLE PROGRAMME', 'wconvert'),
            __('WORKSHOP 01', 'wconvert'),
            __('10:00', 'wconvert'),
            __('10:30', 'wconvert'),
            __('11:15', 'wconvert'),
        ],
        'headline' => [
            __('A morning
well spent.', 'wconvert'),
            __('Look closer', 'wconvert'),
            __('Try a technique', 'wconvert'),
            __('Make it your own', 'wconvert'),
        ],
        'body' => [
            __('See the shape of the workshop before you book.', 'wconvert'),
            __('Meet the tools and the material.', 'wconvert'),
            __('A guided demonstration, with time for questions.', 'wconvert'),
            __('Discuss the next steps for your project.', 'wconvert'),
        ],
        'cta_label' => __('View dates and booking details', 'wconvert'),
        'fine_print' => __('Illustrative programme. Check the actual venue, times, access and terms on the booking page.', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

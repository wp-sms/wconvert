<?php

defined('ABSPATH') || exit;

return [
    'id' => 'event-registration-link',
    'name' => __('Link to a writing workshop registration', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'agenda-card',
    'notes' => __('Embed alongside relevant writing articles. Replace the example agenda, add dates and time zone, then set the button to the external event registration page. Registration, payment and tickets are handled there; WConvert counts link clicks.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('An online conversation', 'wconvert'), __('Explore', 'wconvert'), __('Practise', 'wconvert'), __('Discuss', 'wconvert')],
        'headline' => __('Make room for
better ideas.', 'wconvert'),
        'body' => [__('A live editorial workshop on turning reading notes into a useful writing practice.', 'wconvert'), __('Collect ideas', 'wconvert'), __('Shape a draft', 'wconvert'), __('Ask questions', 'wconvert')],
        'cta_label' => __('View dates and register', 'wconvert'),
        'fine_print' => __('Dates, availability and registration are on the event page.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'page_load',
        ]],
];

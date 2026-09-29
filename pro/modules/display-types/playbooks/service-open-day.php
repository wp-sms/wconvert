<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-open-day',
    'name' => __('Explore a business open day', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'fullscreen-poster',
    'business_types' => ['services'],
    'notes' => __('Use for a real open day with a confirmed date, venue and accessibility information. Configure the event page and campaign end date. A click does not register a visitor.', 'wconvert'),
    'copy' => ['eyebrow'=>__('The studio open day', 'wconvert'), 'headline'=>__('Come and
take a closer look.', 'wconvert'), 'body'=>__('Meet the team, explore the space and see how we work. Find the date, venue and registration details on the event page.', 'wconvert'), 'cta_label'=>__('Explore the open day', 'wconvert'), 'fine_print'=>__('Read the full details before deciding.', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

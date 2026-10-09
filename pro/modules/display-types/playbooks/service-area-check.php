<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-area-check',
    'name' => __('Find service area information', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['services'],
    'notes' => __('Link to a clear service-area page with coverage, exceptions and a contact route. This is an information link, not automatic address or postcode validation.', 'wconvert'),
    'copy' => ['badge'=>__('Service areas', 'wconvert'), 'headline'=>__('Do we cover your area?', 'wconvert'), 'cta_label'=>__('Check service areas', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

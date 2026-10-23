<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-area-check',
    'name' => __('Find service area information', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['services'],
    'notes' => __('Link to a clear service-area page with coverage, exceptions and a contact route. This is an information link, not automatic address or postcode validation.', 'wconvert-pro'),
    'copy' => ['badge'=>__('Service areas', 'wconvert-pro'), 'headline'=>__('Do we cover your area?', 'wconvert-pro'), 'cta_label'=>__('Check service areas', 'wconvert-pro')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

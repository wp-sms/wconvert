<?php

defined('ABSPATH') || exit;

return [
    'id' => 'series-start',
    'name' => __('Start a multi-part article series', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'slide-in-nudge',
    'business_types' => ['publishers'],
    'notes' => __('Target later parts of the series, not part one. Set the actual first-article URL and check that the slide-in does not cover reading controls.', 'wconvert-pro'),
    'copy' => ['headline'=>__('New to
this series?', 'wconvert-pro'), 'cta_label'=>__('Read part one', 'wconvert-pro')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

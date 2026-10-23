<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-ribbon-reminder',
    'name' => __('A ribbon reminder', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-ribbon-reminder',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('WRAPPED WITH A LITTLE LOVE', 'wconvert-pro'), 'headline' => __('Complimentary Christmas gift wrapping.', 'wconvert-pro'), 'body' => __('Complimentary gift wrapping on eligible orders until 20 December.', 'wconvert-pro'), 'fine_print' => __('GIFT WRAPPING ENDS IN', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Shop eligible gifts', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-ribbon-reminder',
    'name' => __('A ribbon reminder', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-ribbon-reminder',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('WRAPPED WITH A LITTLE LOVE', 'wconvert'), 'headline' => __('Complimentary Christmas gift wrapping.', 'wconvert'), 'body' => __('Complimentary gift wrapping on eligible orders until 20 December.', 'wconvert'), 'fine_print' => __('GIFT WRAPPING ENDS IN', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Shop eligible gifts', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

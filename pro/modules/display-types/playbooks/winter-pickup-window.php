<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-pickup-window',
    'name' => __('The pickup window', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-pickup-window',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('CHRISTMAS CLICK & COLLECT', 'wconvert-pro'), 'headline' => __('Christmas click & collect.', 'wconvert-pro'), 'body' => __('Order by 23 December for our Christmas collection window.', 'wconvert-pro'), 'fine_print' => __('PICKUP ORDERS CLOSE IN', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('See pickup details', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

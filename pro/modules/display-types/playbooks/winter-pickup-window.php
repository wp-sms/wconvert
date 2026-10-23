<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-pickup-window',
    'name' => __('The pickup window', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-pickup-window',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('CHRISTMAS CLICK & COLLECT', 'wconvert'), 'headline' => __('Christmas click & collect.', 'wconvert'), 'body' => __('Order by 23 December for our Christmas collection window.', 'wconvert'), 'fine_print' => __('PICKUP ORDERS CLOSE IN', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('See pickup details', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

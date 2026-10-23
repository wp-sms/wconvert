<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-last-sleigh',
    'name' => __('The last sleigh', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-last-sleigh',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE CHRISTMAS DISPATCH', 'wconvert'), 'headline' => __('Christmas orders close 18 December.', 'wconvert'), 'body' => __('Order by 18 December for our Christmas dispatch window.', 'wconvert'), 'fine_print' => __('CHRISTMAS ORDERS CLOSE IN', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('See delivery details', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

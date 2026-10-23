<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-last-sleigh',
    'name' => __('The last sleigh', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-last-sleigh',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('THE CHRISTMAS DISPATCH', 'wconvert-pro'), 'headline' => __('Christmas orders close 18 December.', 'wconvert-pro'), 'body' => __('Order by 18 December for our Christmas dispatch window.', 'wconvert-pro'), 'fine_print' => __('CHRISTMAS ORDERS CLOSE IN', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('See delivery details', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

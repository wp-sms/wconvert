<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-first-page',
    'name' => __('The first page', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-first-page',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['fine_print' => __('2027', 'wconvert'), 'eyebrow' => __('THE FIRST PAGE', 'wconvert'), 'headline' => __('Start the year with 20% off.', 'wconvert'), 'body' => __('Our 20% New Year edit ends on 5 January.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Shop the New Year edit', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

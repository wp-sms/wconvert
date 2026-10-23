<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-first-page',
    'name' => __('The first page', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-first-page',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['body' => [__('2027', 'wconvert-pro'), __('Our 20% New Year edit ends on 5 January.', 'wconvert-pro')], 'eyebrow' => __('THE FIRST PAGE', 'wconvert-pro'), 'headline' => __('Start the year with 20% off.', 'wconvert-pro'), 'fine_print' => __('NEW YEAR OFFER ENDS IN', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Shop the New Year edit', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

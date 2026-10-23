<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-hello-2027',
    'name' => __('Hello, twenty twenty-seven', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-hello-2027',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('SOMETHING GOOD IS JUST BEGINNING', 'wconvert-pro'), 'headline' => __('HELLO,
2027.', 'wconvert-pro'), 'body' => [['text' => __('%i', 'wconvert-pro'), 'italic' => __('a fresh start looks good on you.', 'wconvert-pro')], __('Good things ahead. Start with 20% off our New Year edit, until 5 January.', 'wconvert-pro')], 'cta_label' => __('Meet your new favourites', 'wconvert-pro'), 'fine_print' => [__('NEW YEAR OFFER ENDS IN', 'wconvert-pro'), __('Selected items. Until 5 January. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

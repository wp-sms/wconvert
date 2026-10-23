<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-hello-2027',
    'name' => __('Hello, twenty twenty-seven', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-hello-2027',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('SOMETHING GOOD IS JUST BEGINNING', 'wconvert'), 'headline' => __('HELLO,
2027.', 'wconvert'), 'body' => [['text' => __('%i', 'wconvert'), 'italic' => __('a fresh start looks good on you.', 'wconvert')], __('Good things ahead. Start with 20% off our New Year edit, until 5 January.', 'wconvert')], 'cta_label' => __('Meet your new favourites', 'wconvert'), 'fine_print' => [__('NEW YEAR OFFER ENDS IN', 'wconvert'), __('Selected items. Until 5 January. Offer terms apply.', 'wconvert')], 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

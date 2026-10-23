<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-tied-with-joy',
    'name' => __('Tied with a little joy', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-tied-with-joy',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('A LITTLE CHRISTMAS WISH', 'wconvert'), 'headline' => __('Merry
& bright.', 'wconvert'), 'body' => [__('from our little shop to you', 'wconvert'), __('A little Christmas treat: 20% off our gift edit until 20 December.', 'wconvert')], 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Find a little joy', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

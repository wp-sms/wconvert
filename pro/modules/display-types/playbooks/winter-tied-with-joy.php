<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-tied-with-joy',
    'name' => __('Tied with a little joy', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-tied-with-joy',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('A LITTLE CHRISTMAS WISH', 'wconvert-pro'), 'headline' => __('Merry
& bright.', 'wconvert-pro'), 'body' => [['text' => __('%i', 'wconvert-pro'), 'italic' => __('from our little shop to you', 'wconvert-pro')], __('A little Christmas treat: 20% off our gift edit until 20 December.', 'wconvert-pro')], 'fine_print' => [__('GIFT OFFER ENDS IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Find a little joy', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

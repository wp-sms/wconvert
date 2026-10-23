<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-midnight-garden',
    'name' => __('The midnight garden', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-midnight-garden',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['fine_print' => [__('2027', 'wconvert'), __('Selected items. Offer terms apply.', 'wconvert')], 'eyebrow' => __('THE MIDNIGHT GARDEN', 'wconvert'), 'headline' => __('Let good things grow.
Start with 20% off.', 'wconvert'), 'body' => __('Welcome the new year with 20% off selected pieces until 5 January.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Shop the New Year offer', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

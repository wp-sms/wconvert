<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-midnight-garden',
    'name' => __('The midnight garden', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-midnight-garden',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['body' => [__('2027', 'wconvert-pro'), __('Welcome the new year with 20% off selected pieces until 5 January.', 'wconvert-pro')], 'eyebrow' => __('THE MIDNIGHT GARDEN', 'wconvert-pro'), 'headline' => __('Let good things grow.
Start with 20% off.', 'wconvert-pro'), 'fine_print' => [__('NEW YEAR OFFER ENDS IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Shop the New Year offer', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

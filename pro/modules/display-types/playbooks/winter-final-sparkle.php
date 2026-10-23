<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-final-sparkle',
    'name' => __('A final little sparkle', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-final-sparkle',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('THE CHRISTMAS FINALE', 'wconvert-pro'), 'headline' => __('One last sparkle.
Until 24 December.', 'wconvert-pro'), 'body' => __('Our Christmas edit closes on 24 December. Find something worth giving.', 'wconvert-pro'), 'fine_print' => [__('CHRISTMAS EDIT CLOSES IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Explore Christmas gifts', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

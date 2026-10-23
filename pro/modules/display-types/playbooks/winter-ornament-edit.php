<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-ornament-edit',
    'name' => __('The ornament edit', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-ornament-edit',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('THE ORNAMENT EDIT · 20% OFF', 'wconvert-pro'), 'headline' => __('Make their season sparkle.
Save 20%.', 'wconvert-pro'), 'body' => __('The Christmas ornament edit: 20% off until 20 December.', 'wconvert-pro'), 'fine_print' => [__('ORNAMENT OFFER ENDS IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Shop ornaments with 20% off', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

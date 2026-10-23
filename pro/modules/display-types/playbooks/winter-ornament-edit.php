<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-ornament-edit',
    'name' => __('The ornament edit', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-ornament-edit',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE ORNAMENT EDIT · 20% OFF', 'wconvert'), 'headline' => __('Make their season sparkle.
Save 20%.', 'wconvert'), 'body' => __('The Christmas ornament edit: 20% off until 20 December.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Shop ornaments with 20% off', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

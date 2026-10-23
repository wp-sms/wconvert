<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-before-the-bow',
    'name' => __('Before the bow', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-before-the-bow',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('A NOTE FROM THE GIFT DESK', 'wconvert'), 'headline' => __('Christmas orders
close 18 December.', 'wconvert'), 'body' => __('Our Christmas ordering window closes on 18 December.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Shop before the order cutoff', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

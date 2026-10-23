<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-before-the-bow',
    'name' => __('Before the bow', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-before-the-bow',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('A NOTE FROM THE GIFT DESK', 'wconvert-pro'), 'headline' => __('Christmas orders
close 18 December.', 'wconvert-pro'), 'body' => __('Our Christmas ordering window closes on 18 December.', 'wconvert-pro'), 'fine_print' => [__('CHRISTMAS ORDERS CLOSE IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Shop before the order cutoff', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

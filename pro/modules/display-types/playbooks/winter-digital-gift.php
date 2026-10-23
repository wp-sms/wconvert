<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-digital-gift',
    'name' => __('The digital gift', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-digital-gift',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['headline' => [__('Digital
gift cards', 'wconvert'), __('Good gifts.
No wrapping.', 'wconvert')], 'eyebrow' => __('A THOUGHTFUL DIGITAL GIFT', 'wconvert'), 'body' => __('Our digital gift-card offer ends on 24 December. A thoughtful choice, without the wrapping.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Explore digital gift cards', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

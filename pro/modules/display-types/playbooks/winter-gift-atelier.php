<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-gift-atelier',
    'name' => __('The gift atelier', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-gift-atelier',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE GIFT ATELIER', 'wconvert'), 'headline' => __('Thoughtful
Christmas gifts.', 'wconvert'), 'body' => __('Considered objects. Beautiful details. Explore our Christmas gift edit before it closes on 20 December.', 'wconvert'), 'fine_print' => [__('CHRISTMAS EDIT CLOSES IN', 'wconvert'), __('Selected items. Offer terms apply.', 'wconvert')], 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Explore the Christmas edit', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

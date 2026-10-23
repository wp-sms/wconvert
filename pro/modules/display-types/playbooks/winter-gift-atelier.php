<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-gift-atelier',
    'name' => __('The gift atelier', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-gift-atelier',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('THE GIFT ATELIER', 'wconvert-pro'), 'headline' => __('Thoughtful
Christmas gifts.', 'wconvert-pro'), 'body' => __('Considered objects. Beautiful details. Explore our Christmas gift edit before it closes on 20 December.', 'wconvert-pro'), 'fine_print' => [__('CHRISTMAS EDIT CLOSES IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Explore the Christmas edit', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

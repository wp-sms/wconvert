<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-digital-gift',
    'name' => __('The digital gift', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-digital-gift',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['headline' => [__('Digital
gift cards', 'wconvert-pro'), __('Good gifts.
No wrapping.', 'wconvert-pro')], 'eyebrow' => __('A THOUGHTFUL DIGITAL GIFT', 'wconvert-pro'), 'body' => __('Our digital gift-card offer ends on 24 December. A thoughtful choice, without the wrapping.', 'wconvert-pro'), 'fine_print' => [__('DIGITAL GIFT OFFER ENDS IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Explore digital gift cards', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

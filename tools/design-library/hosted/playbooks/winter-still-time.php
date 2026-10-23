<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-still-time',
    'name' => __('Still time for something', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-still-time',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('THOUGHTFUL DOESN’T HAVE TO TAKE LONG', 'wconvert'), 'headline' => __('A little more time.
15% off digital gifts.', 'wconvert'), 'body' => __('Take 15% off selected digital gifts until 24 December.', 'wconvert'), 'fine_print' => [__('DIGITAL GIFT OFFER ENDS IN', 'wconvert'), __('Selected digital gifts. Offer terms apply.', 'wconvert')], 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Shop digital gifts', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

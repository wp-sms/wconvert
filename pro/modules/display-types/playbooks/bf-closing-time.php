<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-closing-time',
    'name' => __('Closing time', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-closing-time',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('BLACK FRIDAY / CLOSING TIME', 'wconvert-pro'), __('OFFER ENDS IN', 'wconvert-pro')],
        'headline' => [__('Goodbyes can
be good buys.', 'wconvert-pro'), __('25%', 'wconvert-pro')],
        'body' => [__('One last look. A little less.', 'wconvert-pro'), __('OFF
SELECTED FINDS', 'wconvert-pro')],
        'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')],
        'cta_label' => __('Take one last look', 'wconvert-pro'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

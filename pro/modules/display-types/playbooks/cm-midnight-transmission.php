<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-midnight-transmission',
    'name' => __('Midnight transmission', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-midnight-transmission',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY / MIDNIGHT TRANSMISSION', 'wconvert-pro'), __('OFF SELECTED ONLINE FINDS', 'wconvert-pro'), __('THE TRANSMISSION ENDS IN', 'wconvert-pro')],
        'headline' => [__('Great finds.
Finite time.', 'wconvert-pro'), __('40%', 'wconvert-pro'), __('A brighter setup.
A smaller total.', 'wconvert-pro')],
        'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')],
        'cta_label' => __('Catch the final transmission', 'wconvert-pro'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-midnight-transmission',
    'name' => __('Midnight transmission', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-midnight-transmission',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY / MIDNIGHT TRANSMISSION', 'wconvert'), __('OFF SELECTED ONLINE FINDS', 'wconvert'), __('THE TRANSMISSION ENDS IN', 'wconvert')],
        'headline' => [__('Great finds.
Finite time.', 'wconvert'), __('40%', 'wconvert'), __('A brighter setup.
A smaller total.', 'wconvert')],
        'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')],
        'cta_label' => __('Catch the final transmission', 'wconvert'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

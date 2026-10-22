<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-final-markdown',
    'name' => __('The final markdown', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-final-markdown',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('BLACK FRIDAY / THE FINAL MARKDOWN', 'wconvert'), __('OFF YOUR NEXT FAVOURITE', 'wconvert'), __('THE OFFER ENDS IN', 'wconvert')],
        'headline' => [__('A good thing.
While it lasts.', 'wconvert'), __('30%', 'wconvert')],
        'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')],
        'cta_label' => __('Make it yours', 'wconvert'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-final-markdown',
    'name' => __('The final markdown', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-final-markdown',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('BLACK FRIDAY / THE FINAL MARKDOWN', 'wconvert-pro'), __('OFF YOUR NEXT FAVOURITE', 'wconvert-pro'), __('THE OFFER ENDS IN', 'wconvert-pro')],
        'headline' => [__('A good thing.
While it lasts.', 'wconvert-pro'), __('30%', 'wconvert-pro')],
        'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')],
        'cta_label' => __('Make it yours', 'wconvert-pro'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

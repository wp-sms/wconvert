<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-digital-after-hours',
    'name' => __('Digital after hours', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-digital-after-hours',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Set the genuine campaign end date and time; the countdown uses that same deadline. Place the block or shortcode where the offer belongs.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY / AFTER HOURS', 'wconvert'), __('A LITTLE TIME. A GOOD FIND.', 'wconvert')],
        'headline' => [__('Still browsing?
Good timing.', 'wconvert'), __('The late edit
ends in', 'wconvert')],
        'body' => [__('Your next favourite is 30% off. Catch the online edit before it closes.', 'wconvert'), __('Make a little room for something good.', 'wconvert')],
        'cta_label' => __('Explore the late edit', 'wconvert'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert'),
        'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')],
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

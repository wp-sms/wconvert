<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-weekend-edition',
    'name' => __('The weekend edition', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-weekend-edition',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Place the block or shortcode where the offer belongs.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('THE WEEKEND EDITION', 'wconvert'), __('BLACK FRIDAY SPECIAL', 'wconvert'), __('GOOD TASTE. GREAT TIMING.', 'wconvert'), __('OFF THE CURATED EDIT', 'wconvert')],
        'headline' => [__('All the things you love.
A little less.', 'wconvert'), __('30%', 'wconvert')],
        'body' => __('The pieces you’ll reach for long after the weekend.', 'wconvert'),
        'cta_label' => __('Read between the prices', 'wconvert'),
        'fine_print' => __('Less impulse. More intention. Selected pieces. Offer terms apply.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

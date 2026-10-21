<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'halloween-after-dark-offer',
    'name' => __('Halloween after-dark offer', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'halloween-forest',
    'notes' => __('Present a Halloween offer against a quiet forest scene. Replace the sample discount, add a valid coupon and shop link, and set your campaign dates. No email is collected.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('WHEN THE EVERYDAY TURNS EXTRAORDINARY', 'wconvert'), __('HALLOWEEN WEEK', 'wconvert')],
        'headline' => [__('Good things
come after dark.', 'wconvert'), __('30% off', 'wconvert')],
        'body' => [__('Curious objects, warm layers, and a little midnight magic.', 'wconvert'), __('Your invitation to the dark side.', 'wconvert')],
        'cta_label' => __('Shop after dark', 'wconvert'),
        'fine_print' => __('Through October 31.
Selected pieces only.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

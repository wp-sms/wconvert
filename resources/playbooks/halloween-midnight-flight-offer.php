<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'halloween-midnight-flight-offer',
    'name' => __('Halloween midnight flight', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'halloween-bats',
    'notes' => __('Draw attention to a Halloween offer with moving bats. Replace the sample discount, add a valid coupon and shop link, and set a genuine deadline. Motion can be switched off.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('SOMETHING GOOD IS IN THE AIR', 'wconvert'), __('HALLOWEEN WEEK', 'wconvert')],
        'headline' => [__('Midnight has
its perks.', 'wconvert'), __('30% off', 'wconvert')],
        'body' => [__('A fleeting offer for your autumn rituals. Catch it before it disappears.', 'wconvert'), __('Your invitation to the dark side.', 'wconvert')],
        'cta_label' => __('Shop after dark', 'wconvert'),
        'fine_print' => __('Through October 31.
Selected pieces only.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

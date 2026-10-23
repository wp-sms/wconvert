<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-little-gift',
    'name' => __('A little gift', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-little-gift',
    'notes' => __('Link to your seasonal gift edit or information page.', 'wconvert'),
    'copy' => ['eyebrow' => __('A LITTLE SOMETHING, FROM US', 'wconvert'), 'headline' => [__('Small gift.
Big feeling.', 'wconvert'), __('15%', 'wconvert')], 'body' => __('Take 15% off selected gifts for your favourite people.', 'wconvert'), 'cta_label' => __('Shop gifts with 15% off', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

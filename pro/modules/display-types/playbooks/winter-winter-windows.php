<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-winter-windows',
    'name' => __('Winter windows', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-winter-windows',
    'notes' => __('Link to your seasonal gift edit or information page.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE WINTER VILLAGE', 'wconvert'), 'headline' => __('A whole village
of good gifts.', 'wconvert'), 'body' => __('Discover thoughtful gifts for the people who make your world.', 'wconvert'), 'cta_label' => __('Explore Christmas gifts', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

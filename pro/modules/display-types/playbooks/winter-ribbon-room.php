<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-ribbon-room',
    'name' => __('The ribbon room', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-ribbon-room',
    'notes' => __('Link to your seasonal gift edit or information page.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE CHRISTMAS GIFT ATELIER', 'wconvert'), 'headline' => __('A little ceremony.
A lovely gift.', 'wconvert'), 'body' => __('Thoughtful things, beautifully wrapped. Explore our Christmas edit.', 'wconvert'), 'cta_label' => __('Shop Christmas gifts', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];

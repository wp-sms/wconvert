<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-wrapped-in-colour',
    'name' => __('Wrapped in colour', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-wrapped-in-colour',
    'notes' => __('Link to your seasonal gift edit or information page. Place the block or shortcode where this belongs.', 'wconvert'),
    'copy' => ['eyebrow' => __('FOR THE COLOURFULLY CURIOUS', 'wconvert'), 'headline' => __('Not another
beige Christmas.', 'wconvert'), 'body' => __('Bright little things for the wonderfully colourful people in your life.', 'wconvert'), 'cta_label' => __('Shop colourful gifts', 'wconvert'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

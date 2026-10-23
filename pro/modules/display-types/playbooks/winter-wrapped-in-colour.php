<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-wrapped-in-colour',
    'name' => __('Wrapped in colour', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-wrapped-in-colour',
    'notes' => __('Link to your seasonal gift edit or information page. Place the block or shortcode where this belongs.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('FOR THE COLOURFULLY CURIOUS', 'wconvert-pro'), 'headline' => __('Not another
beige Christmas.', 'wconvert-pro'), 'body' => __('Bright little things for the wonderfully colourful people in your life.', 'wconvert-pro'), 'cta_label' => __('Shop colourful gifts', 'wconvert-pro'), 'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-a-little-thank-you',
    'name' => __('A little thank-you', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-a-little-thank-you',
    'notes' => __('Set the action link and review the offer wording. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => __('A little thank-you from us', 'wconvert'), 'headline' => __('Small shop.
Big appreciation.', 'wconvert'), 'body' => ['text' => __('Take 10% off your next order. Thank you for choosing independent.', 'wconvert')], 'cta_label' => __('Find something lovely', 'wconvert'), 'fine_print' => ['text' => __('One use per customer. Excludes gift cards.', 'wconvert')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

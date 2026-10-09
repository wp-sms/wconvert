<?php

defined('ABSPATH') || exit;

return [
    'id' => 'space-fit-finder',
    'name' => __('Find products for a small space', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'space-planner',
    'business_types' => ['stores'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details. Select available WooCommerce products for every result; match their prices, dimensions and contents to the recommendation.', 'wconvert'),
    'copy' => ['screens'=>['screen:space'=>['eyebrow'=>__('Make room', 'wconvert'), 'headline'=>__('Small space.
Useful choices.', 'wconvert'), 'body'=>__('Measure the clear width first. Check the full dimensions before ordering.', 'wconvert'), 'next_label'=>__('Find a starting point', 'wconvert')], 'screen:match'=>['back_label'=>__('Change the space or purpose', 'wconvert')]]],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

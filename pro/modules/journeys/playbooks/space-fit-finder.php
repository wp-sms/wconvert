<?php

defined('ABSPATH') || exit;

return [
    'id' => 'space-fit-finder',
    'name' => __('Find products for a small space', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'space-planner',
    'business_types' => ['stores'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details. Select available WooCommerce products for every result; match their prices, dimensions and contents to the recommendation.', 'wconvert-pro'),
    'copy' => ['screens'=>['screen:space'=>['eyebrow'=>__('Make room', 'wconvert-pro'), 'headline'=>__('Small space.
Useful choices.', 'wconvert-pro'), 'body'=>__('Measure the clear width first. Check the full dimensions before ordering.', 'wconvert-pro'), 'next_label'=>__('Find a starting point', 'wconvert-pro')], 'screen:match'=>['back_label'=>__('Change the space or purpose', 'wconvert-pro')]]],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

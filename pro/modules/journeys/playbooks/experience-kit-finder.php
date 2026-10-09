<?php

defined('ABSPATH') || exit;

return [
    'id' => 'experience-kit-finder',
    'name' => __('Choose a starter or experienced kit', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'kit-workbench',
    'business_types' => ['stores'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details. Select available WooCommerce products for every result; match their prices, dimensions and contents to the recommendation.', 'wconvert'),
    'copy' => ['screens'=>['screen:experience'=>['eyebrow'=>__('The growing workbench', 'wconvert'), 'headline'=>__('Start where
you are.', 'wconvert'), 'body'=>__('Find a useful kit for your next project. Your result needs no contact details.', 'wconvert'), 'next_label'=>__('Continue', 'wconvert')], 'screen:project'=>['eyebrow'=>__('Build on what you know', 'wconvert'), 'headline'=>__('What would you
like to try next?', 'wconvert'), 'next_label'=>__('See my kit', 'wconvert'), 'back_label'=>__('Back to experience', 'wconvert')], 'screen:match'=>['back_label'=>__('Review my answers', 'wconvert')]]],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

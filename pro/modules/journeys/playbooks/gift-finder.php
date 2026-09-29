<?php

defined('ABSPATH') || exit;

return [
    'id' => 'gift-finder',
    'name' => __('Find a gift by recipient and budget', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'gift-edit',
    'business_types' => ['stores'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details. Select available WooCommerce products for every result; match their prices, dimensions and contents to the recommendation.', 'wconvert'),
    'copy' => ['screens'=>['screen:recipient'=>['eyebrow'=>[__('The thoughtful gift edit', 'wconvert'), __('01 · Their interests', 'wconvert')], 'headline'=>__('A gift that feels
like them.', 'wconvert'), 'body'=>__('Start with what they enjoy. Two questions, no signup.', 'wconvert'), 'next_label'=>__('Next: your budget', 'wconvert')], 'screen:budget'=>['eyebrow'=>__('02 · A comfortable budget', 'wconvert'), 'headline'=>__('Something thoughtful.
Within reach.', 'wconvert'), 'next_label'=>__('See gift ideas', 'wconvert'), 'back_label'=>__('Back to interests', 'wconvert')], 'screen:match'=>['back_label'=>__('Change my answers', 'wconvert')]]],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

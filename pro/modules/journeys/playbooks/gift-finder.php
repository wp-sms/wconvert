<?php

defined('ABSPATH') || exit;

return [
    'id' => 'gift-finder',
    'name' => __('Find a gift by recipient and budget', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'gift-edit',
    'business_types' => ['stores'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details. Select available WooCommerce products for every result; match their prices, dimensions and contents to the recommendation.', 'wconvert-pro'),
    'copy' => ['screens'=>['screen:recipient'=>['eyebrow'=>[__('The thoughtful gift edit', 'wconvert-pro'), __('01 · Their interests', 'wconvert-pro')], 'headline'=>__('A gift that feels
like them.', 'wconvert-pro'), 'body'=>__('Start with what they enjoy. Two questions, no signup.', 'wconvert-pro'), 'next_label'=>__('Next: your budget', 'wconvert-pro')], 'screen:budget'=>['eyebrow'=>__('02 · A comfortable budget', 'wconvert-pro'), 'headline'=>__('Something thoughtful.
Within reach.', 'wconvert-pro'), 'next_label'=>__('See gift ideas', 'wconvert-pro'), 'back_label'=>__('Back to interests', 'wconvert-pro')], 'screen:match'=>['back_label'=>__('Change my answers', 'wconvert-pro')]]],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

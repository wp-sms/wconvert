<?php

defined('ABSPATH') || exit;

return [
    'id' => 'reading-path-finder',
    'name' => __('Choose a reading path', 'wconvert'),
    'goal' => 'find_match',
    'template_id' => 'reading-path',
    'business_types' => ['publishers'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details.', 'wconvert'),
    'copy' => ['screens'=>['screen:topic'=>['eyebrow'=>__('A reading path', 'wconvert'), 'headline'=>__('Follow your
curiosity.', 'wconvert'), 'body'=>__('A short sequence, chosen for where you are starting.', 'wconvert'), 'next_label'=>__('Next: your starting point', 'wconvert')], 'screen:depth'=>['eyebrow'=>__('One more detail', 'wconvert'), 'headline'=>__('Start at the
right place.', 'wconvert'), 'next_label'=>__('Find my reading path', 'wconvert'), 'back_label'=>__('Back to subjects', 'wconvert')], 'screen:match'=>['fine_print'=>__('Read at your own pace. No signup is needed.', 'wconvert'), 'back_label'=>__('Choose a different path', 'wconvert')]]],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

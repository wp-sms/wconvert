<?php

defined('ABSPATH') || exit;

return [
    'id' => 'reading-path-finder',
    'name' => __('Choose a reading path', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'reading-path',
    'business_types' => ['publishers'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details.', 'wconvert-pro'),
    'copy' => ['screens'=>['screen:topic'=>['eyebrow'=>__('A reading path', 'wconvert-pro'), 'headline'=>__('Follow your
curiosity.', 'wconvert-pro'), 'body'=>__('A short sequence, chosen for where you are starting.', 'wconvert-pro'), 'next_label'=>__('Next: your starting point', 'wconvert-pro')], 'screen:depth'=>['eyebrow'=>__('One more detail', 'wconvert-pro'), 'headline'=>__('Start at the
right place.', 'wconvert-pro'), 'next_label'=>__('Find my reading path', 'wconvert-pro'), 'back_label'=>__('Back to subjects', 'wconvert-pro')], 'screen:match'=>['fine_print'=>__('Read at your own pace. No signup is needed.', 'wconvert-pro'), 'back_label'=>__('Choose a different path', 'wconvert-pro')]]],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

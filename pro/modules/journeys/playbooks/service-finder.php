<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-finder',
    'name' => __('Find the right service', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'service-directory',
    'business_types' => ['services'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details.', 'wconvert-pro'),
    'copy' => ['screens'=>['screen:needs'=>['eyebrow'=>__('A useful next conversation', 'wconvert-pro'), 'headline'=>__('Find the right kind of help.', 'wconvert-pro'), 'body'=>__('Choose your project and stage. Read the options before deciding to enquire.', 'wconvert-pro'), 'next_label'=>__('Explore my options', 'wconvert-pro')], 'screen:match'=>['back_label'=>__('Change my answers', 'wconvert-pro')]]],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

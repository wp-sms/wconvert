<?php

defined('ABSPATH') || exit;

return [
    'id' => 'project-stage-finder',
    'name' => __('Choose a project’s next step', 'wconvert-pro'),
    'goal' => 'find_match',
    'template_id' => 'project-route',
    'business_types' => ['services'],
    'notes' => __('Review the questions, answer conditions and every result. Set a useful destination for each outcome, including the fallback. Results are available without contact details.', 'wconvert-pro'),
    'copy' => ['screens'=>['screen:stage'=>['eyebrow'=>__('The next-step notebook', 'wconvert-pro'), 'headline'=>__('A clear next step.', 'wconvert-pro'), 'body'=>__('Start with where you are today. No enquiry is required to read the guidance.', 'wconvert-pro'), 'next_label'=>__('Show my next step', 'wconvert-pro'), 'fine_print'=>__('You can change your answer on the next screen.', 'wconvert-pro')], 'screen:match'=>['back_label'=>__('Choose another stage', 'wconvert-pro')]]],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

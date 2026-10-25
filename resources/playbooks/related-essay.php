<?php

defined('ABSPATH') || exit;

return [
    'id' => 'related-essay',
    'name' => __('Suggest a useful next article', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'reading-slip',
    'business_types' => ['publishers'],
    'notes' => __('Embed after a genuinely related article. Link to the promised follow-up and check that it is available to the same audience.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Keep reading', 'wconvert'),
        'headline' => __('Next: putting the idea into practice.', 'wconvert'),
        'body' => __('The follow-up turns this article’s idea into practical steps you can try.', 'wconvert'),
        'fine_print' => __('Continue when you have a moment.', 'wconvert'),
        'cta_label' => __('Read the follow-up', 'wconvert')
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'material-comparison',
    'name' => __('Compare product materials', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'material-pair',
    'business_types' => ['stores'],
    'notes' => __('Replace the sample comparison with accurate materials or services. Set and test the details-page link; this campaign captures no contact information.', 'wconvert'),
    'copy' => ['eyebrow'=>__('Materials, made clear', 'wconvert'), 'headline'=>[__('Choose the feel
that works for you.', 'wconvert'), __('Glazed ceramic', 'wconvert'), __('Natural wood', 'wconvert')], 'body'=>[__('Two finishes. A few practical differences.', 'wconvert'), __('A smooth finish with a little weight.', 'wconvert'), __('Wipe clean. Protect from knocks and frost.', 'wconvert'), __('A warm surface with a visible grain.', 'wconvert'), __('Keep dry. Follow the maker’s care guidance.', 'wconvert')], 'cta_label'=>__('Compare materials and care', 'wconvert'), 'fine_print'=>__('Check the specifications for the exact item.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

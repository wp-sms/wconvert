<?php

defined('ABSPATH') || exit;

return [
    'id' => 'return-policy-guide',
    'name' => __('Explain return conditions before purchase', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'slide-in-nudge',
    'business_types' => ['stores'],
    'notes' => __('Show on relevant product pages. Link to the merchant’s actual current return policy; do not invent legal rights or require signup to read it.', 'wconvert'),
    'copy' => ['headline'=>__('Know the terms
before you choose.', 'wconvert'), 'cta_label'=>__('Read the return policy', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-options-guide',
    'name' => __('Compare service packages', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'service-ledger',
    'business_types' => ['services'],
    'notes' => __('Replace the sample comparison with accurate materials or services. Set and test the details-page link; this campaign captures no contact information.', 'wconvert'),
    'copy' => ['eyebrow'=>__('Ways to work together', 'wconvert'), 'headline'=>[__('The right support.
At the right stage.', 'wconvert'), __('Planning session', 'wconvert'), __('Project support', 'wconvert')], 'body'=>[__('Compare the starting points before we discuss your project.', 'wconvert'), __('For an idea that needs direction.', 'wconvert'), __('Discuss priorities and constraints.', 'wconvert'), __('Leave with questions and next steps.', 'wconvert'), __('For a defined piece of work.', 'wconvert'), __('Agree the scope before work begins.', 'wconvert'), __('Confirm timing and pricing separately.', 'wconvert')], 'cta_label'=>__('Explore the service details', 'wconvert'), 'fine_print'=>__('An enquiry does not confirm a service, price or appointment.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];

<?php

defined('ABSPATH') || exit;

return [
    'id' => 'fit-checklist',
    'name' => __('Prepare measurements before buying', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'useful-guide',
    'business_types' => ['stores'],
    'notes' => __('Show on furniture product pages. Supply a resource covering doorway clearance, stairs, access and final placement. Configure the resource-email destination; confirm delivery separately.', 'wconvert'),
    'copy' => ['eyebrow'=>[__('THE FIT CHECKLIST', 'wconvert'), __('Your next step', 'wconvert')], 'headline'=>[__('03', 'wconvert'), __('Measure before
you choose.', 'wconvert')], 'body'=>[__('Doorways, stairs
and placement.', 'wconvert'), __('Check the space your furniture will use and the route it takes to get there.', 'wconvert')], 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'cta_label'=>__('Request the fit checklist', 'wconvert'), 'fine_print'=>[__('One resource email. No newsletter signup.', 'wconvert'), __('Use the product’s own measurements when checking fit.', 'wconvert')], 'success_headline'=>__('Checklist request received', 'wconvert'), 'success_body'=>[__('Thank you for requesting the furniture-fit checklist.', 'wconvert'), __('Use the checklist to compare access and placement measurements.', 'wconvert')], 'success_action'=>__('Open the checklist', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>['lead_magnet_email'], 'fields'=>['email']],
];

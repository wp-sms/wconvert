<?php

defined('ABSPATH') || exit;

return [
    'id' => 'basket-product-help',
    'name' => __('Offer product help near the basket', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-choice',
    'business_types' => ['stores'],
    'notes' => __('Embed near the basket, away from checkout controls. Assign a person to reply and ask which item is involved; the form does not attach cart contents.', 'wconvert'),
    'copy' => ['headline'=>__('One detail
before you decide?', 'wconvert'), 'body'=>__('Tell us the kind of question you have. We will reply and ask which item you are considering.', 'wconvert'), 'name_label'=>__('Your name (optional)', 'wconvert'), 'name_placeholder'=>__('Alex Morgan', 'wconvert'), 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'interest_label'=>__('What would help? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'fit', 'label'=>__('Size or compatibility', 'wconvert')], ['value'=>'care', 'label'=>__('Materials or care', 'wconvert')], ['value'=>'contents', 'label'=>__('What is included', 'wconvert')]]], 'cta_label'=>__('Request product help', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'fine_print'=>__('We use your details to respond to this request.', 'wconvert'), 'success_headline'=>__('Product-help request received', 'wconvert'), 'success_body'=>__('Thank you. We will use your details to discuss your question. Your basket has not been sent or reserved.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];

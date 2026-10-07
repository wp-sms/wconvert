<?php
/** Create an unsent local draft: wp eval-file tools/integration-preview/seed-preference-sample.php */

if (!defined('WP_CLI') || !WP_CLI || !class_exists(\WConvert\Bootstrap::class)) {
    throw new RuntimeException('Run through WP-CLI with WConvert active.');
}

if (!\WConvert\Template\JourneySupport::active()) {
    WP_CLI::error('The sample needs the question journeys capability.');
}

$container = \WConvert\Bootstrap::container();
$source = json_decode(file_get_contents(__DIR__ . '/fixtures/shopper-preferences.json'), true, 32, JSON_THROW_ON_ERROR);
$template = $container->resolve(\WConvert\Template\TemplateVocabulary::class)->normalize($source);
$config = [
    'template' => $template,
    'display_type' => 'inline',
    'display_rules' => \WConvert\Rules\DisplayPlan::immediate(),
    'capture_mode' => 'local',
    'destinations' => [],
];
$issue = \WConvert\Template\CaptureContract::issue($config, 'grow_email_list', get_privacy_policy_url());
if ($issue !== null) {
    WP_CLI::error('Invalid preference sample: ' . $issue);
}

$campaign = $container->resolve(\WConvert\Optin\OptinRepository::class)->create(
    'QA — Shopper preferences (Running / Hiking)',
    'grow_email_list',
    $config
);
WP_CLI::success('Created a local-only draft. No contacts or provider requests were created.');
WP_CLI::line(admin_url('admin.php?page=wconvert') . '#optins?edit=' . $campaign->id);

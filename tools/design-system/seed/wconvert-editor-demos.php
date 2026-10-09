<?php
/** Local-only, repeatable editor review drafts. Run with wp eval-file. Never publishes. */
declare(strict_types=1);

use WConvert\Bootstrap;
use WConvert\Goal\Goal;
use WConvert\Optin\OptinRepository;
use WConvert\Playbook\Prefill;
use WConvert\Template\CaptureJourney;
use WConvert\Template\JourneyGraph;
use WConvert\Template\TemplateVocabulary;

if (!defined('WP_CLI') || !WP_CLI || wp_parse_url(home_url(), PHP_URL_HOST) !== 'wconvert.local') {
    throw new RuntimeException('These review drafts are only for wconvert.local through WP-CLI.');
}
$root = dirname(__DIR__, 3);
$read = static fn (string $file): array => json_decode(file_get_contents($root . '/' . $file), true, 512, JSON_THROW_ON_ERROR);
$container = Bootstrap::container();
$repository = $container->get(OptinRepository::class);
$prefill = $container->get(Prefill::class);
$vocabulary = $container->get(TemplateVocabulary::class);
$clearFixtureLinks = static function (array $value) use (&$clearFixtureLinks): array {
    if (isset($value['href']) && wp_parse_url($value['href'], PHP_URL_HOST) === 'example.test') { unset($value['href']); }
    foreach ($value as $key => $child) { if (is_array($child)) { $value[$key] = $clearFixtureLinks($child); } }
    return $value;
};
$base = $read('pro/modules/journeys/templates/journey-service-enquiry.json');
$cases = [
    ['DEMO 01 — Simple newsletter signup', Goal::GrowEmailList, 'resources/templates/library/journey-email-only.json'],
    ['DEMO 02 — Email then optional SMS', Goal::GrowEmailList, 'resources/templates/library/journey-email-then-sms.json'],
    ['DEMO 03 — Multiple interests, one enquiry', Goal::CollectEnquiries, 'tests/fixtures/journey-graph-enquiry.json'],
    ['DEMO 04 — Home or business, then relevant questions', Goal::CollectEnquiries, 'tests/fixtures/journey-graph-branch-groups.json'],
    ['DEMO 05 — Coffee quiz with optional signup', Goal::FindMatch, 'tests/fixtures/journey-graph-coffee.json'],
    ['DEMO 06 — Content guide before email signup', Goal::FindMatch, 'pro/modules/journeys/templates/journey-content-guide.json'],
];
// Validate all inputs before creating any drafts.
$prepared = [];
foreach ($cases as [$name, $goal, $file]) {
    $source = $read($file);
    $template = $source['template'] ?? (isset($source['tree']) ? $source : ['tree' => $source, 'tokens' => $base['tokens']]);
    // Sample results must not depend on fixture product IDs or external test URLs.
    foreach ($template['tree']['steps'] as &$step) {
        if (!isset($step['results'])) { continue; }
        $step['products_required'] = false;
        foreach ($step['results'] as &$result) {
            $result['product_ids'] = [];
            $result['href'] = function_exists('wc_get_page_permalink') ? wc_get_page_permalink('shop') : home_url('/');
            $result['link_label'] = 'Explore the store';
        }
        unset($result);
    }
    unset($step);
    $template = $vocabulary->normalize($clearFixtureLinks($template));
    $issue = isset($template['tree']['graph']) ? JourneyGraph::issue($template['tree']) : CaptureJourney::issue($template['tree']);
    if ($issue !== null) {
        throw new RuntimeException($name . ': invalid journey: ' . $issue);
    }
    $config = $prefill->fromScratch($goal)['config'];
    $config['template_id'] = $source['id'] ?? ($goal === Goal::FindMatch ? 'journey-product-finder' : 'journey-service-enquiry');
    $config['template'] = $template;
    $config['display_type'] = 'popup';
    $prepared[] = [$name, $goal, $config];
}
$existing = array_column($repository->summaries(), 'id', 'name');
foreach ($prepared as [$name, $goal, $config]) {
    // Preserve edits if this script is run again.
    $id = $existing[$name] ?? $repository->create($name, $goal->value, $config)->id;
    $saved = $repository->find($id);
    if (!$saved || $saved->publishedAt !== null) {
        throw new RuntimeException('Expected an unpublished review draft: ' . $name);
    }
    WP_CLI::line(wp_json_encode(['id' => $id, 'name' => $name, 'screens' => count($saved->config['template']['tree']['steps']), 'url' => admin_url('admin.php?page=wconvert') . '#optins?edit=' . $id . '&back=%23optins']));
}

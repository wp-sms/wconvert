<?php

/** Export the actual registered and prefilled campaigns; no WordPress writes. */
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Privacy\PrivacyGuidance;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Storage\OptionStore;
use WConvert\Support\SiteDependency;
use WConvert\Support\SitePresence;
use WConvert\Support\Tier;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateSource;
use WConvert\Template\TemplateVocabulary;

define('ABSPATH', '/');
define('WCONVERT_VERSION', '0.1.0');
function __(string $text, string $domain = ''): string { return $text; }
function wp_parse_url(string $url, int $component = -1): mixed { return parse_url($url, $component); }
function esc_html(string $text): string { return htmlspecialchars($text, ENT_QUOTES, 'UTF-8'); }
function esc_html__(string $text, string $domain = ''): string { return esc_html($text); }
function _doing_it_wrong(string $function, string $message, string $version): void { throw new RuntimeException($function . ': ' . $message); }
$root = getenv('WCONVERT_PLUGIN') ?: dirname(__DIR__, 3);
require $root . '/vendor/autoload.php';
$vocabulary = TemplateVocabulary::fromManifest($root);
$source = new class($root) implements TemplateSource {
    public function __construct(private readonly string $root) {}
    public function entries(): array {
        $files = array_merge(glob($this->root . '/resources/templates/library/*.json') ?: [], glob($this->root . '/pro/modules/*/templates/*.json') ?: []);
        return array_map(static fn ($file) => json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR), $files);
    }
};
$templates = TemplateLibrary::from($vocabulary, $source);
$rules = RuleVocabulary::fromManifest($root);
$additional = array_map(static fn ($file) => require $file, glob($root . '/pro/modules/*/playbooks/*.php') ?: []);
$playbooks = PlaybookLibrary::fromDirectory($templates, $vocabulary, $rules, $root, $additional);
$site = new class implements SitePresence { public function has(SiteDependency $dependency): bool { return true; } };
$supplied = new SuppliedRules();
foreach (Tier::cases() as $tier) $supplied->add(...$rules->typesAt($tier, $site));
$options = new class implements OptionStore {
    public function get(string $key, $default = null) { return $default; }
    public function set(string $key, $value): void { throw new RuntimeException('Read-only preview'); }
};
$prefill = new Prefill($playbooks, $templates, $vocabulary, new Degradation($rules, $supplied), new PrivacyGuidance($options));
$collection = json_decode(file_get_contents($root . '/tools/design-library/pilot/collection.json'), true, 512, JSON_THROW_ON_ERROR);
$entries = [];
foreach ($collection['entries'] as $brief) {
    $playbook = $playbooks->find($brief['id']);
    $draft = $prefill->fromPlaybook($brief['id']);
    if ($playbook === null || $draft === null) throw new RuntimeException('Missing pilot: ' . $brief['id']);
    $entries[] = array_merge($brief, [
        'name' => $playbook->name, 'goal' => $playbook->goal->value,
        'display_type' => $playbook->displayType, 'template_id' => $playbook->templateId,
        'notes' => $playbook->notes, 'config' => $draft['config'],
        'tree' => $draft['config']['template']['tree'], 'tokens' => $draft['config']['template']['tokens'],
    ]);
}
echo json_encode($entries, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

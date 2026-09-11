<?php

/** Portable preview data from the shipping Prefill, with every rule supplied. */

use WConvert\Playbook\FlagshipCollection;
use WConvert\Playbook\PlaybookLibrary;
use WConvert\Playbook\Prefill;
use WConvert\Rules\Degradation;
use WConvert\Rules\RuleVocabulary;
use WConvert\Rules\SuppliedRules;
use WConvert\Support\SiteDependency;
use WConvert\Support\SitePresence;
use WConvert\Support\Tier;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateVocabulary;

define('ABSPATH', '/');
function __(string $text, string $domain = ''): string { return $text; }
function _doing_it_wrong(string $function, string $message, string $version): void
{
    throw new RuntimeException($function . ': ' . $message);
}

$root = getenv('WCONVERT_PLUGIN') ?: dirname(__DIR__, 3);
require $root . '/vendor/autoload.php';
$vocabulary = TemplateVocabulary::fromManifest($root);
$templates = TemplateLibrary::fromDirectory($vocabulary, $root);
$rules = RuleVocabulary::fromManifest($root);
$playbooks = PlaybookLibrary::fromDirectory($templates, $vocabulary, $rules, $root);
$site = new class implements SitePresence {
    public function has(SiteDependency $dependency): bool { return true; }
};
$supplied = new SuppliedRules();
foreach (Tier::cases() as $tier) {
    $supplied->add(...$rules->typesAt($tier, $site));
}
$prefill = new Prefill($playbooks, $templates, $vocabulary, new Degradation($rules, $supplied));
$entries = [];
foreach (FlagshipCollection::GROUPS as $audience => $ids) {
    foreach ($ids as $id) {
        $playbook = $playbooks->find($id);
        $draft = $prefill->fromPlaybook($id);
        if ($playbook === null || $draft === null) {
            throw new RuntimeException('Missing starting point: ' . $id);
        }
        $config = $draft['config'];
        $entries[] = [
            'id' => $id,
            'name' => $playbook->name,
            'display_type' => $playbook->displayType,
            'tier' => $playbook->goal->tier()->value,
            'audience' => $audience,
            'recommendation' => FlagshipCollection::recommendation($id),
            'notes' => $playbook->notes,
            'template_id' => $playbook->templateId,
            'tokens' => $config['template']['tokens'],
            'tree' => $config['template']['tree'],
        ];
    }
}
echo json_encode($entries, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);

<?php
/**
 * The form switch's output, checked by the rules publication applies (ADR 0163).
 *
 *   WCONVERT_DUMP_CONVERSIONS=/tmp/conversions.json npx vitest run tests/js/capture-conversion-designs.test.ts
 *   php bin/verify-converted-designs.php /tmp/conversions.json
 *
 * Every converted draft must survive the vocabulary unchanged (a save would
 * otherwise drop part of it), and pass the journey, capture and Goal
 * contracts. Runs standalone on the unit suite's WordPress shims.
 */
declare(strict_types=1);

use WConvert\Goal\Goal;
use WConvert\Template\CaptureContract;
use WConvert\Template\TemplateVocabulary;

require dirname(__DIR__) . '/tests/bootstrap.php';

// This CLI-only check loads the entire catalogue's conversion matrix at once.
// Keep its memory budget independent of a site's PHP request limit.
ini_set('memory_limit', '512M');

$file = $argv[1] ?? '';
$entries = is_file($file) ? json_decode((string) file_get_contents($file), true) : null;
if (!is_array($entries) || $entries === []) { fwrite(STDERR, "No conversions in {$file}.\n"); exit(2); }

$vocabulary = TemplateVocabulary::fromManifest(dirname(__DIR__));
/** Key order is not meaning. */
$canonical = static function ($value) use (&$canonical) {
    if (!is_array($value)) return $value;
    $value = array_map($canonical, $value);
    if (!array_is_list($value)) ksort($value);
    return $value;
};
$failures = [];
foreach ($entries as $entry) {
    $where = "{$entry['design']} → {$entry['target']} ({$entry['goal']})";
    $config = $entry['config'];
    $normalized = $vocabulary->normalize($config['template']);
    if ($canonical($normalized['tree']['steps']) !== $canonical($config['template']['tree']['steps'])) {
        $failures[] = "{$where}: the vocabulary changes the tree";
        continue;
    }
    $config['template'] = $normalized;
    $issue = CaptureContract::issue($config, $entry['goal'], 'https://example.test/privacy/')
        ?? Goal::from($entry['goal'])->outcome()->designIssue($config);
    if ($issue !== null) $failures[] = "{$where}: {$issue}";
}
if ($failures !== []) { fwrite(STDERR, implode("\n", $failures) . "\n"); exit(1); }
echo count($entries) . " converted drafts pass.\n";

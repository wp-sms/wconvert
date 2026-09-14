<?php
/** Build a local fixture service. Tools are excluded from both release ZIPs. */
$root = dirname(__DIR__, 2);
$base = $argv[1] ?? 'http://wconvert.local/wp-content/plugins/wconvert/tools/template-catalog/out';
$templates = [];
foreach (['reading-slip', 'callback-notes', 'useful-guide'] as $id) {
    $templates[] = json_decode(file_get_contents($root . '/resources/templates/library/' . $id . '.json'), true, 512, JSON_THROW_ON_ERROR);
}
$pack = ['schema' => 1, 'id' => 'editorial-service-sample', 'version' => '1.0.0', 'name' => 'Editorial and service sample',
    'description' => 'A local installation sample using three reviewed designs already in the bundled library. Pictures remain placeholders.',
    'requires' => ['plugin' => '0.1.0', 'tree' => 1, 'capabilities' => ['template-tree:1', 'success-actions:1', 'enquiry-choice:1']],
    'assets' => [], 'templates' => $templates];
$json = json_encode($pack, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
@mkdir(__DIR__ . '/out', 0755, true);
file_put_contents(__DIR__ . '/out/sample-1.0.0.json', $json);
$index = ['schema' => 1, 'packs' => [[
    'id' => $pack['id'], 'name' => $pack['name'], 'description' => $pack['description'], 'version' => $pack['version'],
    'url' => rtrim($base, '/') . '/sample-1.0.0.json', 'sha256' => hash('sha256', $json),
]]];
file_put_contents(__DIR__ . '/out/index.json', json_encode($index, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n");
echo "Built local sample catalog.\n";

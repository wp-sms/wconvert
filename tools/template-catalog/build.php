<?php
/** Build reviewed collections as static JSON. No WordPress or network needed. */
declare(strict_types=1);

use WConvert\Template\Catalog\PackValidator;

$root = dirname(__DIR__, 2);
define('ABSPATH', '/');
define('WCONVERT_URL', '');
require $root . '/src/constants.php';
require $root . '/vendor/autoload.php';
function __(string $text, string $domain = ''): string { return $text; }
function wp_parse_url(string $url, int $component = -1): mixed { return parse_url($url, $component); }
function _doing_it_wrong(string $function, string $message, string $version): void { throw new RuntimeException($function . ': ' . $message); }

function encode(array $value): string
{
    return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
}

try {
    $base = rtrim($argv[1] ?? 'http://wconvert.local/wp-content/plugins/wconvert/tools/template-catalog/out', '/');
    $output = $argv[2] ?? __DIR__ . '/out';
    $url = parse_url($base);
    if (!is_array($url) || !in_array($url['scheme'] ?? '', ['http', 'https'], true) || empty($url['host'])
        || isset($url['user']) || isset($url['pass']) || isset($url['query']) || isset($url['fragment'])) {
        throw new RuntimeException('Supply an HTTP(S) directory URL without credentials, query or fragment.');
    }
    $collections = json_decode(file_get_contents(__DIR__ . '/collections.json'), true, 512, JSON_THROW_ON_ERROR);
    $validator = PackValidator::shipping();
    $files = [];
    $index = ['schema' => 1, 'packs' => []];
    $selected = [];
    foreach ($collections as $collection) {
        $templates = [];
        foreach ($collection['templates'] as $id => $digest) {
            if (!PackValidator::identifier($id) || isset($selected[$id])) throw new RuntimeException('Invalid or repeated collection design: ' . $id);
            $source = file_get_contents($root . '/resources/templates/library/' . $id . '.json');
            if ($source === false || !hash_equals($digest, hash('sha256', $source))) {
                throw new RuntimeException('Reviewed source changed: ' . $id . '. Review it, update its fingerprint and bump the collection version.');
            }
            $template = json_decode($source, true, 512, JSON_THROW_ON_ERROR);
            if (($template['id'] ?? null) !== $id) throw new RuntimeException('Design filename and identity differ: ' . $id);
            $templates[] = $template;
            $selected[$id] = true;
        }
        $pack = ['schema' => 1, 'id' => $collection['id'], 'version' => $collection['version'],
            'name' => $collection['name'], 'description' => $collection['description'],
            'requires' => $collection['requires'], 'assets' => [], 'templates' => $templates];
        $json = encode($pack);
        $validator->decode($json); // The shipping installer is the compatibility gate.
        $filename = $pack['id'] . '-' . $pack['version'] . '.json';
        if (isset($files[$filename])) throw new RuntimeException('Repeated collection: ' . $pack['id']);
        $files[$filename] = $json;
        $index['packs'][] = ['id' => $pack['id'], 'version' => $pack['version'], 'name' => $pack['name'],
            'description' => $pack['description'], 'url' => $base . '/' . $filename, 'sha256' => hash('sha256', $json)];
    }
    // Preflight every release before writing anything. Rebuilds preserve old packs.
    foreach ($files as $filename => $json) {
        $path = $output . '/' . $filename;
        if (file_exists($path) && file_get_contents($path) !== $json) {
            throw new RuntimeException('Refusing to replace ' . $filename . '. Bump the collection version.');
        }
    }
    if (!is_dir($output) && !mkdir($output, 0755, true)) throw new RuntimeException('Could not create output directory.');
    foreach ($files as $filename => $json) {
        $path = $output . '/' . $filename;
        if (is_file($path)) continue;
        if (file_put_contents($path, $json, LOCK_EX) !== strlen($json)) throw new RuntimeException('Could not write ' . $filename);
    }
    // Readers only see the new index after every referenced pack is in place.
    $temporary = tempnam($output, '.index-');
    if ($temporary === false) throw new RuntimeException('Could not stage the catalog index.');
    try {
        $json = encode($index);
        if (file_put_contents($temporary, $json, LOCK_EX) !== strlen($json) || !rename($temporary, $output . '/index.json')) {
            throw new RuntimeException('Could not write the catalog index.');
        }
    } finally {
        if (is_file($temporary)) unlink($temporary);
    }
    echo 'Built ' . count($files) . ' collections / ' . count($selected) . ' unchanged designs in ' . $output . ".\n";
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}

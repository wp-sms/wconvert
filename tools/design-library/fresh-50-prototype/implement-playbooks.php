<?php
/** One-time handoff: take every repeated copy role through the shipping extractor. */
declare(strict_types=1);
define('ABSPATH', '/');
$root = dirname(__DIR__, 3);
require $root . '/vendor/autoload.php';
$vocabulary = \WConvert\Template\TemplateVocabulary::fromManifest($root);
$mapping = json_decode(file_get_contents($root . '/docs/reviews/everyday-2026-10-24/prototype-map.json'), true, 512, JSON_THROW_ON_ERROR);
$quote = static fn (string $s): string => "'" . str_replace(['\\', "'"], ['\\\\', "\\'"], $s) . "'";
$domain = 'wconvert';
$php = static function (mixed $value, bool $translate = false) use (&$php, $quote, &$domain): string {
    if (is_array($value)) {
        $list = array_is_list($value);
        $parts = [];
        foreach ($value as $key => $item) $parts[] = ($list ? '' : $quote((string) $key) . ' => ') . $php($item, $translate && !in_array($key, ['href', 'value'], true));
        return '[' . implode(', ', $parts) . ']';
    }
    if (is_string($value)) return $translate && $value !== '' ? '__(' . $quote($value) . ', ' . $quote($domain) . ')'  : $quote($value);
    return var_export($value, true);
};
foreach ($mapping as $item) {
    $id = $item['native_id'];
    $domain = $item['tier'] === 'pro' ? 'wconvert-pro' : 'wconvert';
    $design = json_decode(file_get_contents($root . '/' . $item['directory'] . '/templates/' . $id . '.json'), true, 512, JSON_THROW_ON_ERROR);
    $copy = \WConvert\Template\SlotRoles::copyFrom($design['tree'], $vocabulary);
    unset($copy['code_value'], $copy['wordmark']);
    $rules = [['type' => in_array($design['display_type'], ['inline', 'floating_bar'], true) ? 'page_load' : 'time_on_page']];
    if ($rules[0]['type'] === 'time_on_page') $rules[0]['seconds'] = 15;
    $fields = $design['tree']['submissions'] ?? [] ? ['email'] : [];
    $source = "<?php\n\ndefined('ABSPATH') || exit;\n\nreturn [\n";
    foreach ([
        'business_types' => [$item['audience']], 'id' => $id, 'name' => $item['name'], 'goal' => $item['goal'],
        'template_id' => $id, 'notes' => implode(' ', $item['requirements']), 'copy' => $copy,
        'rules' => $rules, 'destination_hint' => ['types' => [], 'fields' => $fields],
    ] as $key => $value) $source .= '    ' . $quote($key) . ' => ' . $php($value, in_array($key, ['name', 'notes', 'copy'], true)) . ",\n";
    file_put_contents($root . '/' . $item['directory'] . '/playbooks/' . $id . '.php', $source . "];\n");
}
echo "50 matching Playbooks generated through SlotRoles::copyFrom.\n";

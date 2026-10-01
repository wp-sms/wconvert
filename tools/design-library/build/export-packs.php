<?php
/** Trusted repository sources only. This CLI never loads WordPress or writes site data. */
define('ABSPATH', '/');
$root = dirname(__DIR__, 3);
define('WCONVERT_URL', '');
require $root . '/src/constants.php';
function __(string $text, string $domain = ''): string { return $text; }
function wp_parse_url(string $url, int $component = -1): mixed { return parse_url($url, $component); }
function _doing_it_wrong(string $function, string $message, string $version): void { throw new RuntimeException($function . ': ' . $message); }
require $root . '/vendor/autoload.php';
use WConvert\Support\Tier;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;
use WConvert\Template\Catalog\PackValidator;

$validator = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest(), Tier::Elite);
$input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
if (($input['mode'] ?? '') === 'validate') {
    foreach ($input['packs'] as $pack) $validator->decode($pack['json']);
    // Exercise the complete shipping refresh path (including metadata, URLs and references).
    $transport = new class($input['responses']) implements \WConvert\Template\Catalog\CatalogTransport {
        public function __construct(private array $responses) {}
        public function get(string $url): string { return $this->responses[$url] ?? throw new RuntimeException('Missing release object'); }
    };
    $options = new class($input['source']) implements \WConvert\Storage\OptionStore {
        private array $data;
        public function __construct(string $source) { $this->data = [\WConvert\Template\Catalog\TemplateCatalog::SOURCE_OPTION => $source]; }
        public function get(string $key, $default = null) { return $this->data[$key] ?? $default; }
        public function set(string $key, $value): void { $this->data[$key] = $value; }
    };
    $installed = new \WConvert\Template\Catalog\InstalledPacks($input['empty_directory'], $validator);
    $catalog = new \WConvert\Template\Catalog\TemplateCatalog($options, $transport, $validator, $installed);
    $catalog->refresh();
    foreach ($input['packs'] as $pack) $catalog->preview(json_decode($pack['json'], true)['id']);
    echo "Validated by the shipping catalog and pack reader.\n";
    exit;
}
$output = [];
foreach ($input['packs'] as $definition) {
$templates = []; $setups = []; $paid = false;
foreach ($definition['setups'] as $id) {
    if (!PackValidator::identifier($id)) throw new RuntimeException('Invalid setup identity');
    $files = array_merge(glob($root . '/resources/playbooks/' . $id . '.php') ?: [], glob($root . '/pro/modules/*/playbooks/' . $id . '.php') ?: []);
    if (count($files) !== 1) throw new RuntimeException('Missing or ambiguous setup: ' . $id);
    $setup = require $files[0];
    $designs = array_merge(glob($root . '/resources/templates/library/' . $setup['template_id'] . '.json') ?: [], glob($root . '/pro/modules/*/templates/' . $setup['template_id'] . '.json') ?: []);
    if (count($designs) !== 1) throw new RuntimeException('Missing or ambiguous design');
    $template = json_decode(file_get_contents($designs[0]), true, 48, JSON_THROW_ON_ERROR);
    $templates[$template['id']] = $template; $setups[] = $setup;
    $paid = $paid || $template['tier'] !== 'free' || \WConvert\Goal\Goal::from($setup['goal'])->tier() !== Tier::Free;
}
    $pack = ['schema' => 1, 'id' => $definition['id'], 'version' => $definition['version'], 'name' => $definition['name'], 'description' => $definition['description'],
        'requires' => ['plugin' => WCONVERT_VERSION, 'tree' => 2, 'capabilities' => PackValidator::CAPABILITIES],
        'assets' => [], 'templates' => array_values($templates), 'playbooks' => $setups];
    $json = json_encode($pack, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    try { $validator->decode($json); } catch (RuntimeException $error) { throw new RuntimeException($definition['id'] . ': ' . $error->getMessage()); }
    $output[] = ['access' => $paid ? 'premium' : 'free', 'json' => $json];
}
echo json_encode($output, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

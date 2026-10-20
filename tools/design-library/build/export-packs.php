<?php
/** Trusted repository sources only. This CLI never loads WordPress or writes site data. */
define('ABSPATH', '/');
$root = isset($argv[1]) ? realpath($argv[1]) : dirname(__DIR__, 3);
if (!$root || !is_file($root . '/src/constants.php')) throw new RuntimeException('Invalid trusted source root');
define('WCONVERT_URL', '');
require $root . '/src/constants.php';
function __(string $text, string $domain = ''): string { return $text; }
// Trusted authoring simulates the capabilities whose source modules are loaded.
// The shipping reader still checks the receiving site's actual registrations.
function apply_filters(string $hook, mixed $value, mixed ...$args): mixed { return in_array($hook, ['wconvert_journeys', 'wconvert_commerce'], true) ? true : $value; }
// WordPress filesystem adapters for the disposable, caller-owned validation archive.
function wp_mkdir_p(string $path): bool { return is_dir($path) || mkdir($path, 0700, true); }
function wp_delete_file(string $path): void { if (is_file($path)) unlink($path); }
function wp_parse_url(string $url, int $component = -1): mixed { return parse_url($url, $component); }
function wp_json_encode(mixed $value, int $flags = 0, int $depth = 512): string|false { return json_encode($value, $flags, $depth); }
function _doing_it_wrong(string $function, string $message, string $version): void { throw new RuntimeException($function . ': ' . $message); }
require $root . '/vendor/autoload.php';
use WConvert\Support\Tier;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;
use WConvert\Template\Catalog\PackValidator;

$validator = new PackValidator(TemplateManifest::load(), TemplateVocabulary::fromManifest(), Tier::Pro);
$input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);
function publicDesignFacts(array $template): array {
    return [
        'bundled' => true, 'bundle_tier' => $template['tier'],
        'prerequisites' => ['plugins' => \WConvert\Template\CommerceSupport::used($template['tree']) || \WConvert\Template\CommerceSupport::quizAdditions($template['tree'])
            || array_filter($template['tree']['steps'], static fn (array $step): bool => ($step['products_required'] ?? false) === true
                || (bool) array_filter($step['results'] ?? [], static fn (array $result): bool => isset($result['product_filter']) || !empty($result['product_ids']))) ? ['woocommerce'] : []],
    ];
}
if (($input['mode'] ?? '') === 'bundled-gallery') {
    $output = [];
    foreach ($input['design_ids'] as $id) {
        if (!PackValidator::identifier($id)) throw new RuntimeException('Invalid design identity');
        $files = array_merge(glob($root . '/resources/templates/library/' . $id . '.json') ?: [], glob($root . '/pro/modules/*/templates/' . $id . '.json') ?: []);
        if (count($files) !== 1) throw new RuntimeException('Missing or ambiguous bundled design');
        $template = json_decode(file_get_contents($files[0]), true, 48, JSON_THROW_ON_ERROR);
        // Internal render container only: never stored as a delivery pack or editable public JSON.
        $output[] = ['json' => json_encode(['id' => $id, 'name' => $template['name'], 'templates' => [$template]], JSON_THROW_ON_ERROR),
            'media' => [], 'public_metadata' => [$id => publicDesignFacts($template)]];
    }
    echo json_encode($output, JSON_THROW_ON_ERROR);
    exit;
}
if (($input['mode'] ?? '') === 'validate') {
    foreach ($input['packs'] as $pack) $validator->decode($pack['json']);
    // Exercise the complete shipping refresh path (including metadata, URLs and references).
    $transport = new class($input['responses']) implements \WConvert\Template\Catalog\CatalogTransport, \WConvert\Template\Catalog\CatalogImageTransport, \WConvert\Template\Catalog\CatalogPackTransport {
        public function pack(string $url, string $digest): string { return $this->get($url); }
        public function __construct(private array $responses) {}
        public function image(string $url, int $bytes): string { return base64_decode($this->responses[$url] ?? throw new RuntimeException('Missing image object'), true); }
        public function get(string $url): string { return $this->responses[$url] ?? throw new RuntimeException('Missing release object'); }
    };
    $options = new class($input['source']) implements \WConvert\Storage\OptionStore {
        private array $data;
        public function __construct(string $source) { $this->data = [\WConvert\Template\Catalog\TemplateCatalog::SOURCE_OPTION => $source]; }
        public function get(string $key, $default = null) { return $this->data[$key] ?? $default; }
        public function set(string $key, $value): void { $this->data[$key] = $value; }
    };
    $installed = new \WConvert\Template\Catalog\InstalledPacks($input['empty_directory'] . '/packs', $validator, new \WConvert\Template\Catalog\VerifiedAssets($input['empty_directory'] . '/images', 'https://local.example/images'));
    $catalog = new \WConvert\Template\Catalog\TemplateCatalog($options, $transport, $validator, $installed);
    $catalog->refresh();
    foreach ($input['packs'] as $pack) $catalog->preview(json_decode($pack['json'], true)['id']);
    echo "Validated by the shipping catalog and pack reader.\n";
    exit;
}
$ruleManifest = \WConvert\Rules\RuleManifest::load();
$ruleDefinitions = $ruleManifest['triggers'] + $ruleManifest['conditions'] + $ruleManifest['targeting'];
$output = [];
foreach ($input['packs'] as $definition) {
$templates = []; $setups = []; $paid = false; $assets = []; $bindings = []; $media = [];
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
    foreach (array_merge($setup['rules'], $setup['targeting']['include'] ?? [], $setup['targeting']['exclude'] ?? []) as $rule) {
        $paid = $paid || ($ruleDefinitions[$rule['type']]['tier'] ?? 'free') !== 'free';
    }
}
    // The bundled source can remain a compact vector. An explicit, independently
    // reviewed derivative is bound to its exact source URI and raster bytes.
    foreach ($templates as &$template) {
        $walk = function (array &$node) use (&$walk, &$assets, &$bindings, &$media, $template, $input): void {
            if (($node['type'] ?? '') === 'image' && ($node['src'] ?? '') !== '') {
                $raster = $input['raster_sources'][hash('sha256', $node['src'])] ?? $node['src'];
                if (!preg_match('#^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$#D', $raster, $match)) throw new RuntimeException('Artwork must be reviewed PNG, JPEG or WebP source bytes. SVG conversion needs a new review.');
                $bytes = base64_decode($match[2], true);
                if ($bytes === false) throw new RuntimeException('Invalid artwork encoding');
                $info = getimagesizefromstring($bytes); $hash = hash('sha256', $bytes); $id = 'image-' . substr($hash, 0, 24);
                $rights = $input['image_rights'][$hash] ?? null;
                if (!$info || $info['mime'] !== $match[1] || !is_array($rights) || ($rights['redistribution'] ?? false) !== true || empty($rights['source']) || empty($rights['reviewedBy'])) throw new RuntimeException('Record image source, redistribution rights and reviewer before export.');
                $assets[$id] = ['id' => $id, 'sha256' => $hash, 'mime' => $match[1], 'bytes' => strlen($bytes), 'width' => $info[0], 'height' => $info[1], 'access' => $rights['access'] ?? 'premium'];
                $media[$id] = ['id' => $id, 'base64' => $match[2], 'rights' => $rights];
                $bindings[] = ['template_id' => $template['id'], 'node_id' => $node['id'], 'asset_id' => $id];
                $node['src'] = '';
            }
            foreach (['children', 'start', 'end'] as $key) if (isset($node[$key])) foreach ($node[$key] as &$child) $walk($child);
        };
        foreach ($template['tree']['steps'] as &$step) $walk($step['content']);
        unset($step);
    }
    unset($template);
    $treeVersion = max(array_column(array_column(array_values($templates), 'tree'), 'v'));
    $capabilities = array_values(array_diff(PackValidator::CAPABILITIES, array_merge($assets ? [] : ['pack-images:1'], $treeVersion === 3 ? [] : ['template-tree:3'])));
    $pack = ['schema' => $assets ? 2 : 1, 'id' => $definition['id'], 'version' => $definition['version'], 'name' => $definition['name'], 'description' => $definition['description'],
        'requires' => ['plugin' => WCONVERT_VERSION, 'tree' => $treeVersion, 'capabilities' => $capabilities],
        'assets' => array_values($assets), 'templates' => array_values($templates), 'playbooks' => $setups];
    if ($assets) $pack['image_bindings'] = $bindings;
    $json = json_encode($pack, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    try { $validator->decode($json); } catch (RuntimeException $error) { throw new RuntimeException($definition['id'] . ': ' . $error->getMessage()); }
    // Public facts come from the same capability predicates used by the installer.
    // Every source resolved above belongs to a shipped Free or Pro template directory.
    $publicMetadata = [];
    foreach ($templates as $template) {
        $publicMetadata[$template['id']] = publicDesignFacts($template);
    }
    $output[] = ['access' => $paid ? 'premium' : 'free', 'json' => $json, 'media' => array_values($media), 'public_metadata' => $publicMetadata];
}
echo json_encode($output, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

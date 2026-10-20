<?php
/**
 * Export reviewed repository designs and setups as catalogue v3 objects
 * (docs/template-discovery-api.md, ADR 0156).
 *
 * Trusted repository sources only. This CLI never loads WordPress or writes
 * site data. Every object it emits has already passed the shipping strict
 * reader, and declares exactly what it uses: `requires.plugin` from the
 * vocabulary's `since` stamps, `capabilities` from the reader's own count.
 *
 * Modes, read from a JSON object on stdin:
 *   designs  — {designs, setups, metadata, raster_sources, image_rights} → objects
 *   validate — {source, responses, designs, setups, empty_directory} → runs the
 *              shipping TemplateCatalog over an in-memory copy of the release
 */
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
function wp_is_writable(string $path): bool { return is_writable($path); }
function wp_delete_file(string $path): void { if (is_file($path)) unlink($path); }
function wp_parse_url(string $url, int $component = -1): mixed { return parse_url($url, $component); }
function wp_json_encode(mixed $value, int $flags = 0, int $depth = 512): string|false { return json_encode($value, $flags, $depth); }
function get_transient(string $name): mixed { return false; }
function set_transient(string $name, mixed $value, int $expiration = 0): bool { return true; }
function _doing_it_wrong(string $function, string $message, string $version): void { throw new RuntimeException($function . ': ' . $message); }
require $root . '/vendor/autoload.php';

use WConvert\Support\Tier;
use WConvert\Template\Catalog\DesignObject;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\VocabularySince;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;

const FLAGS = JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
const RIGHTS_KINDS = ['original', 'ai-generated', 'licensed'];
const PRO_FORMATS = ['floating_bar', 'slide_in', 'fullscreen'];

$validator = new PackValidator(TemplateManifest::load($root), TemplateVocabulary::fromManifest($root), Tier::Pro);
$since = VocabularySince::load($root);
$input = json_decode(stream_get_contents(STDIN), true, 64, JSON_THROW_ON_ERROR);

function source(string $root, string $kind, string $id): string
{
    if (!PackValidator::identifier($id)) throw new RuntimeException('Invalid identity: ' . $id);
    $files = $kind === 'design'
        // Free, every Pro module, and designs the catalogue alone serves (ADR 0157).
        ? array_merge(glob($root . '/resources/templates/library/' . $id . '.json') ?: [], glob($root . '/pro/modules/*/templates/' . $id . '.json') ?: [],
            glob($root . '/tools/design-library/hosted/templates/' . $id . '.json') ?: [])
        : array_merge(glob($root . '/resources/playbooks/' . $id . '.php') ?: [], glob($root . '/pro/modules/*/playbooks/' . $id . '.php') ?: []);
    if (count($files) !== 1) throw new RuntimeException('Missing or ambiguous ' . $kind . ': ' . $id);
    return $files[0];
}

/** Other plugins a design needs, read with the installer's own predicates. */
function prerequisites(array $template): array
{
    $tree = $template['tree'];
    return \WConvert\Template\CommerceSupport::used($tree) || \WConvert\Template\CommerceSupport::quizAdditions($tree)
        || array_filter($tree['steps'], static fn (array $step): bool => ($step['products_required'] ?? false) === true
            || (bool) array_filter($step['results'] ?? [], static fn (array $result): bool => isset($result['product_filter']) || !empty($result['product_ids'])))
        ? ['woocommerce'] : [];
}

/**
 * Bind each image node to a reviewed raster asset. The bundled source may stay
 * a compact vector; only an explicitly reviewed derivative, bound to its exact
 * source URI and bytes, is exported. Every image needs a rights record.
 *
 * @return array{0: array<string, mixed>, 1: list<array<string, mixed>>, 2: list<array<string, mixed>>, 3: list<array<string, mixed>>}
 */
function images(array $template, array $input): array
{
    $assets = []; $bindings = []; $media = [];
    $walk = function (array &$node) use (&$walk, &$assets, &$bindings, &$media, $template, $input): void {
        if (($node['type'] ?? '') === 'image' && ($node['src'] ?? '') !== '') {
            $raster = $input['raster_sources'][hash('sha256', $node['src'])] ?? $node['src'];
            if (!preg_match('#^data:(image/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$#D', $raster, $match)) throw new RuntimeException('Artwork must be reviewed PNG, JPEG or WebP source bytes. SVG conversion needs a new review.');
            $bytes = base64_decode($match[2], true);
            if ($bytes === false) throw new RuntimeException('Invalid artwork encoding');
            $info = getimagesizefromstring($bytes); $hash = hash('sha256', $bytes); $id = 'image-' . substr($hash, 0, 24);
            $rights = $input['image_rights'][$hash] ?? null;
            if (!$info || $info['mime'] !== $match[1] || !is_array($rights) || ($rights['redistribution'] ?? false) !== true || empty($rights['source']) || empty($rights['reviewedBy'])
                || !in_array($rights['kind'] ?? null, RIGHTS_KINDS, true) || (($rights['kind'] ?? null) === 'licensed' && empty($rights['licence']))) {
                throw new RuntimeException('Record the image kind (original, ai-generated or licensed), source, redistribution rights and reviewer before export.');
            }
            $access = $rights['access'] ?? 'premium';
            if ($template['tier'] === 'free' && $access !== 'free') throw new RuntimeException('A Free design cannot use a premium image.');
            $assets[$id] = ['id' => $id, 'sha256' => $hash, 'mime' => $match[1], 'bytes' => strlen($bytes), 'width' => $info[0], 'height' => $info[1], 'access' => $access];
            $media[$id] = ['id' => $id, 'base64' => $match[2], 'rights' => $rights];
            $bindings[] = ['node_id' => $node['id'], 'asset_id' => $id];
            $node['src'] = '';
        }
        foreach (['children', 'start', 'end'] as $key) if (isset($node[$key])) foreach ($node[$key] as &$child) $walk($child);
    };
    foreach ($template['tree']['steps'] as &$step) $walk($step['content']);
    unset($step);
    return [$template, array_values($assets), $bindings, array_values($media)];
}

if (($input['mode'] ?? '') === 'designs') {
    $ruleManifest = \WConvert\Rules\RuleManifest::load($root);
    $ruleDefinitions = $ruleManifest['triggers'] + $ruleManifest['conditions'] + $ruleManifest['targeting'];
    $output = ['designs' => [], 'setups' => [], 'failures' => []];
    $packs = [];
    foreach ($input['designs'] as $request) {
        $id = $request['id'];
        try {
            $template = json_decode((string) file_get_contents(source($root, 'design', $id)), true, 48, JSON_THROW_ON_ERROR);
            // The wire says a flow with `graph` and `v` is the vocabulary (ADR 0156).
            $template['tree']['v'] = \WConvert\Template\TemplateTree::VERSION;
            [$template, $assets, $bindings, $media] = images($template, $input);
            $meta = DesignObject::meta($request['meta'] ?? []);
            $object = ['schema' => 3, 'minor' => DesignObject::MINOR, 'id' => $id, 'revision' => $request['revision'], 'name' => $template['name'],
                'display_type' => $template['display_type'], 'tier' => $template['tier']]
                + (PackValidator::identifier($request['family'] ?? null) ? ['family' => $request['family']] : [])
                + ($meta !== [] ? ['meta' => $meta] : [])
                + ['requires' => ['plugin' => '1.0.0', 'tree' => $template['tree']['v'], 'capabilities' => PackValidator::CAPABILITIES],
                    'assets' => $assets] + ($bindings !== [] ? ['image_bindings' => $bindings] : []) + ['tree' => $template['tree'], 'tokens' => $template['tokens']];
            // Declare exactly what the content uses: one pass to count, one to prove the count.
            $required = [];
            $probe = json_encode($object, FLAGS);
            $validator->validate(DesignObject::design($probe, hash('sha256', $probe))['pack'], $required);
            $object['requires']['capabilities'] = $required;
            $object['requires']['plugin'] = $since->requiredBy($object, $required);
            $json = json_encode($object, FLAGS);
            $unwrapped = DesignObject::design($json, hash('sha256', $json));
            $validated = $validator->validate($unwrapped['pack']);
            $packs[$id] = $unwrapped['pack'];
            $facets = $validated['templates'][0]['facets'];
            $output['designs'][] = [
                'id' => $id, 'revision' => $request['revision'], 'tier' => $template['tier'], 'json' => $json, 'media' => $media,
                'entry' => ['id' => $id, 'revision' => $request['revision'], 'name' => $template['name'], 'format' => $template['display_type'], 'tier' => $template['tier']]
                    + (isset($object['family']) ? ['family' => $object['family']] : [])
                    + (!empty($request['aliases']) ? ['aliases' => array_values($request['aliases'])] : [])
                    // An entry stays small: a new capability always raises the
                    // plugin version through its `since` stamp, so the version
                    // alone says "update"; the object still declares both.
                    + (($meta['slug'] ?? $id) !== $id ? ['slug' => $meta['slug']] : []) + ['requires' => ['plugin' => $object['requires']['plugin']]]
                    + (prerequisites($template) !== [] ? ['prerequisites' => prerequisites($template)] : [])
                    + ['tags' => array_values(array_merge(...array_map(static fn (string $group, string $prefix): array => array_map(static fn (string $term): string => $prefix . ':' . $term, $meta[$group] ?? []),
                        ['industries', 'occasions', 'style', 'colour'], ['industry', 'occasion', 'style', 'colour']))),
                        // Defaults are left out: false, null and empty read back the same.
                        'facets' => array_filter(['act' => $facets['act'], 'captures' => $facets['captures'], 'shape' => $facets['shape'], 'has_image' => $facets['has_image'], 'asks_consent' => $facets['asks_consent']],
                            static fn (mixed $value): bool => $value !== null && $value !== false && $value !== [])],
            ];
        } catch (RuntimeException $error) {
            $output['failures'][] = ['kind' => 'design', 'id' => $id, 'reason' => $error->getMessage()];
        }
    }
    foreach ($input['setups'] as $request) {
        $id = $request['id'];
        try {
            $setup = require source($root, 'setup', $id);
            $designId = $setup['template_id'];
            if (!isset($packs[$designId])) throw new RuntimeException('Its design ' . $designId . ' is not exported in this release.');
            $design = array_values(array_filter($output['designs'], static fn (array $row): bool => $row['id'] === $designId))[0];
            // A setup's plan is the highest its design, Goal, format and rules need.
            $paidRules = false;
            foreach (array_merge($setup['rules'], $setup['targeting']['include'] ?? [], $setup['targeting']['exclude'] ?? []) as $rule) {
                $paidRules = $paidRules || ($ruleDefinitions[$rule['type']]['tier'] ?? 'free') !== 'free';
            }
            $paid = $design['tier'] !== 'free' || \WConvert\Goal\Goal::from($setup['goal'])->tier() !== Tier::Free || $paidRules || in_array($design['entry']['format'], PRO_FORMATS, true);
            $capabilities = array_values(array_merge(['campaign-starts:1'], $paidRules ? ['paid-campaign-rules:1'] : []));
            $object = ['schema' => 3, 'minor' => DesignObject::MINOR, 'id' => $id, 'revision' => $request['revision'], 'name' => $setup['name'], 'tier' => $paid ? 'pro' : 'free',
                'design' => ['id' => $designId, 'revision' => $design['revision']],
                'requires' => ['plugin' => (new VocabularySince([], []))->requiredBy(['tree' => ['steps' => []], 'tokens' => []], $capabilities), 'capabilities' => $capabilities],
                'playbook' => array_diff_key($setup, array_flip(['id', 'name', 'template_id']))];
            $json = json_encode($object, FLAGS);
            $validator->validate(DesignObject::setup($json, hash('sha256', $json), $packs[$designId], $design['revision'])['pack']);
            $output['setups'][] = ['id' => $id, 'revision' => $request['revision'], 'tier' => $object['tier'], 'json' => $json,
                'entry' => ['id' => $id, 'revision' => $request['revision'], 'name' => $setup['name'], 'goal' => $setup['goal'], 'tier' => $object['tier'],
                    'design' => $object['design'], 'requires' => $object['requires']] + (isset($design['entry']['prerequisites']) ? ['prerequisites' => $design['entry']['prerequisites']] : [])];
        } catch (RuntimeException $error) {
            $output['failures'][] = ['kind' => 'setup', 'id' => $id, 'reason' => $error->getMessage()];
        }
    }
    echo json_encode($output, FLAGS);
    exit;
}

if (($input['mode'] ?? '') === 'validate') {
    // Exercise the complete shipping read path: pointer, release, pages,
    // preview, install and setup install, against an in-memory copy.
    $transport = new class($input['responses']) implements \WConvert\Template\Catalog\CatalogTransport, \WConvert\Template\Catalog\CatalogImageTransport, \WConvert\Template\Catalog\CatalogPremiumTransport {
        public function __construct(private array $responses) {}
        public function get(string $url, int $limit = PackValidator::MAX_BYTES, int $timeout = \WConvert\Template\Catalog\CatalogTransport::TIMEOUT): string { $body = $this->responses[$url] ?? throw new RuntimeException('Missing release object ' . $url); if (strlen($body) > $limit) throw new RuntimeException('Oversized object ' . $url); return $body; }
        public function revalidate(string $url, ?string $etag): ?array { return ['body' => $this->get($url, 65536), 'etag' => null]; }
        public function image(string $url, int $bytes): string { return base64_decode($this->responses[$url] ?? throw new RuntimeException('Missing image object ' . $url), true); }
        public function authorize(array $designs, array $setups): void {}
        public function premium(string $path, int $limit): string { $base = $this->responses['@base']; $body = $this->responses[$base . $path] ?? throw new RuntimeException('Missing premium object ' . $path); return str_starts_with($path, 'premium/assets/') ? base64_decode($body, true) : $body; }
    };
    $options = new class($input['source']) implements \WConvert\Storage\OptionStore {
        private array $data;
        public function __construct(string $source) { $this->data = [\WConvert\Template\Catalog\TemplateCatalog::SOURCE_OPTION => $source, \WConvert\Template\Catalog\TemplateCatalog::CONSENT_OPTION => 'yes']; }
        public function get(string $key, $default = null) { return $this->data[$key] ?? $default; }
        public function set(string $key, $value): void { $this->data[$key] = $value; }
    };
    $archive = new \WConvert\Template\Catalog\DesignArchive($input['empty_directory'] . '/templates', $validator, 'validation',
        new \WConvert\Template\Catalog\VerifiedAssets($input['empty_directory'] . '/images', 'https://local.example/images'), 'validation');
    $catalog = new \WConvert\Template\Catalog\TemplateCatalog($options, $transport, $validator, $archive, Tier::Pro, null, static fn (): array => ['woocommerce' => true],
        null, TemplateVocabulary::fromManifest($root)->facets());
    $status = $catalog->refresh();
    $listed = array_column($status['designs'], 'state', 'id');
    foreach ($input['designs'] as $id) {
        if (($listed[$id] ?? null) !== 'install') throw new RuntimeException($id . ' is not installable from the release: ' . ($listed[$id] ?? 'missing'));
        $catalog->preview($id);
    }
    $setups = array_column($status['setups'], null, 'id');
    foreach ($input['setups'] as $id) {
        if (!isset($setups[$id])) throw new RuntimeException('Setup ' . $id . ' is missing from the release');
        $catalog->installSetup($id, $setups[$id]['sha256']);
    }
    if (count($archive->playbooks()) !== count($input['setups'])) throw new RuntimeException('Not every installed setup registers a starting point');
    echo 'Validated ' . count($input['designs']) . ' designs and ' . count($input['setups']) . " setups with the shipping catalogue reader.\n";
    exit;
}

throw new RuntimeException('Unknown export mode');

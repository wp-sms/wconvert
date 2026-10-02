<?php
/** Native WordPress media rehearsal. Temporary files and intercepted HTTP only; no site data writes. */
$bootstrap = getenv('WCONVERT_WP_BOOTSTRAP');
if (!$bootstrap || !is_file($bootstrap)) throw new RuntimeException('Set WCONVERT_WP_BOOTSTRAP');
require $bootstrap;
use WConvert\Template\Catalog\{InstalledPacks, PackValidator, TemplateCatalog, VerifiedAssets, WpCatalogTransport};
$directory = sys_get_temp_dir() . '/wconvert-native-media-' . bin2hex(random_bytes(8));
$image = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA1sAAAAASUVORK5CYII=');
$designBytes = file_get_contents(WCONVERT_DIR . '/resources/templates/library/reading-slip.json');
if ($designBytes === false) throw new RuntimeException('Missing source fixture');
$design = json_decode($designBytes, true);
$design['tree']['steps'][0]['content']['children'][] = ['type' => 'image', 'id' => 'n99', 'src' => '', 'alt' => 'Transport verification fixture'];
$pack = ['schema' => 2, 'id' => 'native-media', 'name' => 'Native media rehearsal', 'version' => '1.0.0', 'description' => 'Temporary verification only.',
 'requires' => ['plugin' => '0.1.0', 'tree' => 2, 'capabilities' => ['template-tree:2', 'capture-journey:1', 'pack-images:1']],
 'assets' => [['id' => 'fixture', 'sha256' => hash('sha256', $image), 'bytes' => strlen($image), 'mime' => 'image/png', 'width' => 1, 'height' => 1, 'access' => 'free']],
 'image_bindings' => [['template_id' => 'reading-slip', 'node_id' => 'n99', 'asset_id' => 'fixture']], 'templates' => [$design]];
$json = json_encode($pack, JSON_THROW_ON_ERROR);
$source = 'https://templates.example/manifest.json';
$responses = [$source => json_encode(['schema' => 1, 'packs' => [[...array_intersect_key($pack, array_flip(['id', 'name', 'version', 'description'])), 'url' => 'https://templates.example/pack.json', 'sha256' => hash('sha256', $json)]]]), 'https://templates.example/pack.json' => $json, 'https://templates.example/assets/free/' . hash('sha256', $image) . '.png' => $image];
$requests = [];
$intercept = static function ($response, $args, $url) use (&$responses, &$requests, $image) {
 $requests[] = $url;
 if (!isset($responses[$url])) throw new RuntimeException('Unexpected request: ' . $url);
 $limit = str_contains($url, '/assets/') ? strlen($image) + 1 : PackValidator::MAX_BYTES + 1;
 if ($args['redirection'] !== 0 || $args['limit_response_size'] !== $limit) throw new RuntimeException('Unbounded transport');
 return ['response' => ['code' => 200], 'body' => $responses[$url], 'headers' => []];
};
add_filter('pre_http_request', $intercept, 10, 3);
try {
 $options = new class($source) implements \WConvert\Storage\OptionStore {
  /** @var array<string, mixed> */
  private array $values;
  public function __construct(string $source) { $this->values = [TemplateCatalog::SOURCE_OPTION => $source]; }
  public function get(string $key, $default = null) { return $this->values[$key] ?? $default; }
  public function set(string $key, $value): void { $this->values[$key] = $value; }
 };
 $validator = PackValidator::shipping();
 $store = new VerifiedAssets($directory . '/images', home_url('/verification-images'));
 $installed = new InstalledPacks($directory . '/packs', $validator, $store);
 $catalog = new TemplateCatalog($options, new WpCatalogTransport(), $validator, $installed);
 $catalog->refresh(); $preview = $catalog->preview('native-media');
 if ($installed->entries() !== []) throw new RuntimeException('Preview registered a design');
 $catalog->install('native-media', $preview['digest']);
 if ($preview !== $catalog->preview('native-media', true)) throw new RuntimeException('Preview/install mismatch');
 $before = count($requests); $responses = [];
 $offline = new InstalledPacks($directory . '/packs', $validator, $store);
 if (count($offline->entries()) !== 1 || count($requests) !== $before) throw new RuntimeException('Offline lookup failed');
 if (file_get_contents($directory . '/packs/' . hash('sha256', $json) . '.json') !== $json) throw new RuntimeException('Raw pack changed');
 echo "PASS: native WordPress bounded HTTP, image verification, exact preview/install, immutable archive and offline lookup. No external requests or site writes.\n";
} finally {
 remove_filter('pre_http_request', $intercept, 10);
 if (is_dir($directory)) {
  $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
  foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
  rmdir($directory);
 }
}

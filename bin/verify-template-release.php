<?php
/** Read-only WordPress boot, isolated catalog options and disposable file archive.
 * WCONVERT_WP_BOOTSTRAP=/path/to/wp-load.php WCONVERT_RELEASE_DIRECTORY=/private/release php bin/verify-template-release.php
 * Never changes site settings/campaigns or sends a provider message.
 */
declare(strict_types=1);
use WConvert\Template\Catalog\CatalogTransport;
use WConvert\Template\Catalog\InstalledPacks;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;

$bootstrap = getenv('WCONVERT_WP_BOOTSTRAP');
if (!defined('ABSPATH') && is_string($bootstrap) && is_file($bootstrap)) require $bootstrap;
if (!defined('WCONVERT_VERSION')) throw new RuntimeException('Boot a WordPress site with WConvert active.');
$directory = getenv('WCONVERT_RELEASE_DIRECTORY');
if (!is_string($directory) || !is_dir($directory)) throw new RuntimeException('A local release directory is required.');
$manifest = json_decode((string) file_get_contents($directory . '/public/manifest.json'), true, 24, JSON_THROW_ON_ERROR);
$origin = parse_url($manifest['pages'][0]['url']);
if (!is_array($origin) || !isset($origin['scheme'], $origin['host'])) throw new RuntimeException('Invalid release origin.');
$source = $origin['scheme'] . '://' . $origin['host'] . (isset($origin['port']) ? ':' . $origin['port'] : '') . '/manifest.json';
$options = new class($source) implements \WConvert\Storage\OptionStore {
    /** @var array<string, mixed> */ private array $data;
    public function __construct(string $source) { $this->data = [TemplateCatalog::SOURCE_OPTION => $source]; }
    public function get(string $key, $default = null) { return $this->data[$key] ?? $default; }
    public function set(string $key, $value): void { $this->data[$key] = $value; }
};
$transport = new class($directory) implements CatalogTransport {
    public bool $offline = false;
    public function __construct(private string $directory) {}
    public function get(string $url): string {
        if ($this->offline) throw new RuntimeException('Offline test');
        $key = parse_url($url, PHP_URL_PATH);
        if (!is_string($key) || !preg_match('~^/(manifest\.json|packs/[a-f0-9]{64}\.json|releases/[a-f0-9]{64}/page-[0-9]+\.json)$~D', $key)) throw new RuntimeException('Only public release fixtures are read by this verifier');
        $bytes = file_get_contents($this->directory . '/public' . $key);
        if ($bytes === false) throw new RuntimeException('Missing release fixture');
        return $bytes;
    }
};
$temp = sys_get_temp_dir() . '/wconvert-native-release-' . bin2hex(random_bytes(8));
$validator = PackValidator::shipping();
$installed = new InstalledPacks($temp, $validator);
$catalog = new TemplateCatalog($options, $transport, $validator, $installed);
try {
    $index = $catalog->refresh();
    foreach ($index['packs'] as $pack) {
        $preview = $catalog->preview($pack['id']);
        $catalog->install($pack['id'], $preview['digest']);
        if ($catalog->preview($pack['id'], true) !== $preview) throw new RuntimeException('Installed preview differs from inspected content');
        echo 'PASS native preview/install: ' . $pack['id'] . "\n";
    }
    $before = $installed->entries(); $transport->offline = true;
    foreach ($index['packs'] as $pack) $catalog->preview($pack['id'], true);
    if ($installed->entries() !== $before) throw new RuntimeException('Offline content changed');
    echo 'PASS offline library: ' . count($before) . ' designs, ' . count($installed->playbooks()) . ' setups, ' . count($catalog->collections()) . " collections\n";
    echo 'WordPress ' . get_bloginfo('version') . ' / PHP ' . PHP_VERSION . "; no site settings or campaigns changed.\n";
} finally {
    foreach (glob($temp . '/*') ?: [] as $file) unlink($file);
    if (is_dir($temp)) rmdir($temp);
}

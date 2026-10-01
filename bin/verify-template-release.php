<?php
/** Read-only WordPress boot, isolated catalog options and disposable file archive.
 * WCONVERT_WP_BOOTSTRAP=/path/to/wp-load.php WCONVERT_RELEASE_DIRECTORY=/private/release php bin/verify-template-release.php
 * Never changes site settings/campaigns or sends a provider message.
 */
declare(strict_types=1);
use WConvert\Template\Catalog\CatalogTransport;
use WConvert\Template\Catalog\CatalogImageTransport;
use WConvert\Template\Catalog\InstalledPacks;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Template\Catalog\VerifiedAssets;

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
$transport = new class($directory) implements CatalogTransport, CatalogImageTransport {
    public bool $offline = false;
    public int $imageDownloads = 0;
    /** @var array<string, string> Isolated update fixtures, never published. */
    public array $fixtures = [];
    public function __construct(private string $directory) {}
    public function get(string $url): string {
        if ($this->offline) throw new RuntimeException('Offline test');
        $key = parse_url($url, PHP_URL_PATH);
        if (isset($this->fixtures[$key])) return $this->fixtures[$key];
        if (!is_string($key) || !preg_match('~^/(manifest\.json|packs/[a-f0-9]{64}\.json|releases/[a-f0-9]{64}/page-[0-9]+\.json)$~D', $key)) throw new RuntimeException('Only public release fixtures are read by this verifier');
        $bytes = file_get_contents($this->directory . '/public' . $key);
        if ($bytes === false) throw new RuntimeException('Missing release fixture');
        return $bytes;
    }
    public function image(string $url, int $bytes): string {
        if ($this->offline) throw new RuntimeException('Offline image test');
        $key = parse_url($url, PHP_URL_PATH);
        if (!is_string($key) || !preg_match('~^/assets/free/[a-f0-9]{64}\.(png|jpg|webp)$~D', $key)) throw new RuntimeException('Only public image fixtures are read');
        $file = $this->directory . '/public' . $key;
        if (!is_file($file) || filesize($file) !== $bytes) throw new RuntimeException('Image size mismatch');
        $this->imageDownloads++;
        return (string) file_get_contents($file);
    }
};
$temp = sys_get_temp_dir() . '/wconvert-native-release-' . bin2hex(random_bytes(8));
$validator = PackValidator::shipping();
$assets = new VerifiedAssets($temp . '/images', home_url('/verification-images'));
$installed = new InstalledPacks($temp . '/packs', $validator, $assets);
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
    $transport->offline = false;
    foreach ($installed->packs() as $pack) {
        if ($pack['assets'] === []) continue;
        $raw = (string) file_get_contents($temp . '/packs/' . $pack['digest'] . '.json');
        if (hash('sha256', $raw) !== $pack['digest']) throw new RuntimeException('Archived bytes changed');
        $savedDesign = $catalog->preview($pack['id'], true)['templates'][0];
        // Exercise a copy-only update of the real illustrated pack. The synthetic
        // next version exists only in this isolated transport and temporary archive.
        $updated = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
        $version = explode('.', $updated['version']); $version[2] = (string) ((int) $version[2] + 1);
        $updated['version'] = implode('.', $version);
        $updated['description'] .= ' Local update rehearsal.';
        $json = json_encode($updated, JSON_THROW_ON_ERROR);
        $digest = hash('sha256', $json);
        $address = '/packs/' . $digest . '.json';
        $base = substr($source, 0, -strlen('/manifest.json'));
        $transport->fixtures = ['/manifest.json' => json_encode(['schema' => 1, 'packs' => [[
            ...array_intersect_key($updated, array_flip(['id', 'name', 'version', 'description'])),
            'url' => $base . $address, 'sha256' => $digest,
        ]]], JSON_THROW_ON_ERROR), $address => $json];
        $downloads = $transport->imageDownloads;
        $status = $catalog->refresh();
        if ($status['packs'][0]['state'] !== 'update') throw new RuntimeException('New version not offered as an update');
        $preview = $catalog->preview($pack['id']);
        $catalog->install($pack['id'], $preview['digest']);
        if ($transport->imageDownloads !== $downloads) throw new RuntimeException('Unchanged artwork downloaded again');
        if (file_get_contents($temp . '/packs/' . $pack['digest'] . '.json') !== $raw) throw new RuntimeException('Update replaced old snapshot');
        $transport->offline = true;
        $reopened = new InstalledPacks($temp . '/packs', $validator, $assets);
        $old = array_values(array_filter($reopened->entries(), static fn (array $entry): bool => $entry['id'] === $savedDesign['id']));
        if (count($old) !== 1 || $old[0]['tree'] !== $savedDesign['tree'] || $old[0]['catalog_current'] !== false) throw new RuntimeException('Old design or its local image changed');
        if ($catalog->preview($pack['id'], true) !== $preview) throw new RuntimeException('Updated offline preview changed');
        foreach ($pack['assets'] as $asset) {
            if (hash_file('sha256', $temp . '/images/' . VerifiedAssets::key($asset)) !== $asset['sha256']) throw new RuntimeException('Artwork changed');
        }
        echo 'PASS illustrated update/offline: ' . $pack['id'] . "; unchanged artwork reused, original snapshot retained\n";
        $transport->offline = false;
    }
    echo 'WordPress ' . get_bloginfo('version') . ' / PHP ' . PHP_VERSION . "; no site settings or campaigns changed.\n";
} finally {
    if (is_dir($temp)) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($temp, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($temp);
    }
}

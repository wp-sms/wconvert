<?php
/**
 * A local catalogue v3 release, read by the shipping reader inside a real
 * WordPress (ADR 0156, docs/template-discovery-api.md).
 *
 *   WCONVERT_WP_BOOTSTRAP=/path/to/wp-load.php \
 *   WCONVERT_RELEASE_DIRECTORY=/private/release \
 *   php bin/verify-template-release.php
 *
 * Read-only for the site: isolated options in memory, a disposable archive and
 * image store in the temp directory, the site's real salts, uploads helpers and
 * HTTP-free transport over the release directory. Premium objects are read
 * from private/ as Pro's transport would after a pass; no licence is checked.
 * Never changes site settings or campaigns.
 */
declare(strict_types=1);

use WConvert\Template\Catalog\CatalogImageTransport;
use WConvert\Template\Catalog\CatalogPremiumTransport;
use WConvert\Template\Catalog\CatalogTransport;
use WConvert\Template\Catalog\DesignArchive;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Template\Catalog\VerifiedAssets;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateVocabulary;

$bootstrap = getenv('WCONVERT_WP_BOOTSTRAP');
if (!defined('ABSPATH') && is_string($bootstrap) && is_file($bootstrap)) require $bootstrap;
if (!defined('WCONVERT_VERSION')) throw new RuntimeException('Boot a WordPress site with WConvert active.');
$directory = getenv('WCONVERT_RELEASE_DIRECTORY');
if (!is_string($directory) || !is_file($directory . '/public/v3/manifest.json')) throw new RuntimeException('A local v3 release directory is required.');
$base = 'https://release.invalid/v3/';

$options = new class($base) implements \WConvert\Storage\OptionStore {
    /** @var array<string, mixed> */ private array $data;
    public function __construct(string $base) { $this->data = [TemplateCatalog::SOURCE_OPTION => $base . 'manifest.json', TemplateCatalog::CONSENT_OPTION => 'yes']; }
    public function get(string $key, $default = null) { return $this->data[$key] ?? $default; }
    public function set(string $key, $value): void { $this->data[$key] = $value; }
};
$transport = new class($directory, $base) implements CatalogTransport, CatalogImageTransport, CatalogPremiumTransport {
    /** @var list<string> */ public array $requests = [];
    public bool $offline = false;
    public function __construct(private string $directory, private string $base) {}
    public function get(string $url, int $limit = PackValidator::MAX_BYTES, int $timeout = CatalogTransport::TIMEOUT): string { return $this->read('public', $url, $limit); }
    /** @return array{body: string, etag: string|null} */
    public function revalidate(string $url, ?string $etag): array { return ['body' => $this->read('public', $url, 65536), 'etag' => null]; }
    public function image(string $url, int $bytes): string { return $this->read('public', $url, $bytes); }
    public function authorize(array $designs, array $setups): void {}
    public function premium(string $path, int $limit): string { return $this->read('private', $this->base . substr($path, strlen('premium/')), $limit); }
    private function read(string $scope, string $url, int $limit): string
    {
        if ($this->offline) throw new RuntimeException('Offline');
        $this->requests[] = $url;
        if (!str_starts_with($url, $this->base)) throw new RuntimeException('Unexpected address ' . $url);
        $file = $this->directory . '/' . $scope . '/v3/' . substr($url, strlen($this->base));
        $bytes = is_file($file) ? (string) file_get_contents($file) : throw new RuntimeException('Missing ' . $url);
        if (strlen($bytes) > $limit) throw new RuntimeException('Oversized ' . $url);
        return $bytes;
    }
};

$temp = rtrim(get_temp_dir(), '/') . '/wconvert-release-check-' . bin2hex(random_bytes(6));
// The site's own plan and plugins: a design this site cannot run is reported, not installed.
$tier = (new \WConvert\Support\WpProPresence())->installedTier();
$validator = PackValidator::shipping();
$assets = new VerifiedAssets($temp . '/images', 'https://site.invalid/images');
$archive = static fn (): DesignArchive => new DesignArchive($temp . '/templates', $validator, wp_salt('auth'), $assets, 'release-check');
$catalog = static fn () => new TemplateCatalog($options, $transport, $validator, $archive(), $tier, null, static fn (): array => ['woocommerce' => class_exists('WooCommerce')], null, TemplateVocabulary::fromManifest()->facets());
$report = ['tier' => $tier->value, 'woocommerce' => class_exists('WooCommerce'), 'release' => null, 'designs' => 0, 'setups' => 0, 'images' => 0, 'skipped' => [], 'offline_designs' => 0, 'keyed_names' => true];
try {
    $status = $catalog()->refresh();
    $report['release'] = $status['release'];
    foreach ($status['designs'] as $design) {
        // `ready` is a design this site already bundles at that revision.
        if (!in_array($design['state'], ['install', 'ready'], true)) { $report['skipped'][$design['state']][] = $design['id']; continue; }
        $catalog()->install($design['id'], $design['sha256']);
        $report['designs']++;
    }
    foreach ($status['setups'] as $setup) {
        if (!in_array($setup['state'], ['install', 'ready'], true)) { $report['skipped']['setup:' . $setup['state']][] = $setup['id']; continue; }
        $catalog()->installSetup($setup['id'], $setup['sha256']);
        $report['setups']++;
    }
    // GLOB_BRACE is not portable (it is missing on some builds, Playground's among them).
    $report['images'] = count(array_filter(glob($temp . '/images/*/*') ?: [], static fn (string $file): bool => (bool) preg_match('/\.(png|jpg|webp)$/', $file)));
    foreach (glob($temp . '/templates/*/*.json') ?: [] as $file) {
        foreach ($transport->requests as $url) if (str_contains($url, '/' . substr(basename($file), 0, 64))) $report['keyed_names'] = false;
    }
    // Offline: everything installed still registers, with no request at all.
    $transport->offline = true;
    $library = TemplateLibrary::from(TemplateVocabulary::fromManifest(), $archive());
    $report['offline_designs'] = count($library->all());
    if ($report['offline_designs'] < $report['designs']) throw new RuntimeException('Installed designs did not survive going offline');
    if (count($archive()->playbooks()) !== $report['setups']) throw new RuntimeException('Installed setups did not survive going offline');
    echo wp_json_encode($report + ['result' => 'pass'], JSON_PRETTY_PRINT), "\n";
} finally {
    if (is_dir($temp)) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($temp, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($temp);
    }
}

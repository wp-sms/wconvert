<?php
/** Disposable WordPress → real HTTPS API acceptance. No persistent site options. */
declare(strict_types=1);

use WConvert\Template\Catalog\InstalledPacks;
use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\TemplateCatalog;
use WConvert\Template\Catalog\VerifiedAssets;
use WConvert\Template\Catalog\WpCatalogTransport;

if (!defined('WCONVERT_VERSION') || !defined('WCONVERT_TEMPLATE_API_ORIGIN')) throw new RuntimeException('Boot the disposable WordPress verifier first');
$expected = getenv('WCONVERT_EXPECTED_RELEASE');
if (!is_string($expected) || !preg_match('/^[a-f0-9]{64}$/D', $expected)) throw new RuntimeException('Expected release required');
$source = WCONVERT_TEMPLATE_API_ORIGIN . '/manifest.json';
$transport = new WpCatalogTransport();
$manifest = json_decode($transport->get($source), true, 24, JSON_THROW_ON_ERROR);
if (($manifest['release'] ?? '') !== $expected) throw new RuntimeException('Unexpected hosted release');
$options = new class($source) implements \WConvert\Storage\OptionStore {
    private array $values;
    public function __construct(string $source) { $this->values = [TemplateCatalog::SOURCE_OPTION => $source]; }
    public function get(string $key, $default = null) { return $this->values[$key] ?? $default; }
    public function set(string $key, $value): void { $this->values[$key] = $value; }
};
$temp = sys_get_temp_dir() . '/wconvert-hosted-' . bin2hex(random_bytes(8));
$validator = PackValidator::shipping();
$assets = new VerifiedAssets($temp . '/images', home_url('/verification-images'));
$installed = new InstalledPacks($temp . '/packs', $validator, $assets);
$catalog = new TemplateCatalog($options, $transport, $validator, $installed);
$offline = false; $requests = 0;
$guard = static function ($result, $args, $url) use (&$offline, &$requests) {
    if (!str_starts_with($url, WCONVERT_TEMPLATE_API_ORIGIN . '/')) return new WP_Error('unexpected_host', 'Verification only permits the configured API');
    foreach ($args['headers'] ?? [] as $name => $value) {
        if (in_array(strtolower((string) $name), ['authorization', 'x-license-key', 'cookie'], true)) throw new RuntimeException('Public request included credentials');
    }
    if ($offline) return new WP_Error('offline_test', 'Deliberate offline verification');
    $requests++;
    return $result; // Real WordPress HTTP transport; no successful response is mocked.
};
add_filter('pre_http_request', $guard, 10, 3);
try {
    $index = $catalog->refresh(); $previews = []; $refused = 0;
    foreach ($index['packs'] as $pack) {
        if (($pack['access'] ?? 'free') === 'premium') {
            try { $catalog->preview($pack['id']); throw new RuntimeException('Premium unexpectedly downloaded'); }
            catch (RuntimeException $error) {
                if ($error->getMessage() !== __('WConvert Pro is needed to download this premium pack. Public previews are still available.', 'wconvert')) throw $error;
            }
            $refused++;
            continue;
        }
        $preview = $catalog->preview($pack['id']);
        $catalog->install($pack['id'], $preview['digest']);
        $previews[$pack['id']] = $preview;
        echo 'PASS HTTPS preview/install: ' . $pack['id'] . "\n";
    }
    if (!$previews || !$refused) throw new RuntimeException('Expected Free and premium catalogue entries');
    $imageCount = 0;
    foreach ($installed->packs() as $pack) foreach ($pack['assets'] as $asset) {
        if (hash_file('sha256', $temp . '/images/' . VerifiedAssets::key($asset)) !== $asset['sha256']) throw new RuntimeException('Installed image hash mismatch');
        $imageCount++;
    }
    if (!$imageCount) throw new RuntimeException('Expected illustrated pack');
    $offline = true; $entries = $installed->entries();
    try { $catalog->refresh(); throw new RuntimeException('Offline refresh unexpectedly succeeded'); }
    catch (RuntimeException $error) {
        if ($error->getMessage() !== __('The catalog could not be reached. Installed designs are still available. Retry when the connection returns.', 'wconvert')) throw $error;
    }
    foreach ($previews as $id => $preview) if ($catalog->preview($id, true) !== $preview) throw new RuntimeException('Offline preview changed');
    if ($installed->entries() !== $entries) throw new RuntimeException('Offline refresh changed installed designs');
    echo 'PASS live HTTPS catalogue: ' . count($previews) . ' Free packs; ' . count($entries) . ' designs; ' . count($installed->playbooks()) . ' setups; ' . $imageCount . ' verified images; ' . $refused . ' premium refusal; ' . $requests . " public HTTP requests. Offline recovery passed.\n";
    echo 'WordPress ' . get_bloginfo('version') . ' / PHP ' . PHP_VERSION . "; no persistent site options or campaigns changed.\n";
} finally {
    remove_filter('pre_http_request', $guard, 10);
    if (is_dir($temp)) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($temp, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
        rmdir($temp);
    }
}

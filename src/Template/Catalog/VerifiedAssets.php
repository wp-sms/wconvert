<?php
namespace WConvert\Template\Catalog;

defined('ABSPATH') || exit;

/** Verified, content-addressed local images for pack previews and installation.
 * The future transport must bound each response before returning its bytes.
 * Server entitlement is checked before this class; it is not a licence verifier.
 */
final class VerifiedAssets
{
    public const MAX_BYTES = 5242880;
    private const TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    public function __construct(private readonly string $directory, private readonly string $baseUrl) {}

    /** @param list<array<string, mixed>> $assets
     * @param callable(array<string, mixed>): string $download Bounded, already authorized transport.
     * @return array<string, string> Stable local URLs by asset ID. */
    public function install(string $packDigest, array $assets, callable $download): array
    {
        PackValidator::check(preg_match('/^[a-f0-9]{64}$/D', $packDigest) === 1, __('Invalid media package identity.', 'wconvert'));
        self::validate($assets);
        $this->folder($this->directory);
        PackValidator::check(!is_link($this->directory . '/.install.lock'), __('The image store contains an unsupported link.', 'wconvert'));
        $lock = @fopen($this->directory . '/.install.lock', 'c');
        if ($lock === false) throw new \RuntimeException(__('The image store is unavailable.', 'wconvert'));
        try {
            PackValidator::check(flock($lock, LOCK_EX | LOCK_NB), __('Another image installation is in progress. Try again.', 'wconvert'));
            $this->folder($this->directory . '/sets');
            $manifest = $this->directory . '/sets/' . $packDigest . '.json';
            $json = json_encode(['schema' => 1, 'assets' => $assets], JSON_THROW_ON_ERROR);
            PackValidator::check(!is_link($manifest), __('The image store contains an unsupported link.', 'wconvert'));
            if (is_file($manifest)) PackValidator::check(file_get_contents($manifest) === $json, __('This image package changed. Inspect the new revision.', 'wconvert'));
            else PackValidator::check(count(glob($this->directory . '/sets/*.json') ?: []) < 128, __('The local image archive is full.', 'wconvert'));
            $staged = []; $urls = [];
            try {
                foreach ($assets as $asset) {
                    $scope = $asset['access']; $extension = self::TYPES[$asset['mime']];
                    $key = $scope . '/' . $asset['sha256'] . '.' . $extension;
                    $path = $this->directory . '/' . $key;
                    $this->folder($this->directory . '/' . $scope);
                    PackValidator::check(!is_link($path), __('The image store contains an unsupported link.', 'wconvert'));
                    $cached = is_file($path) && filesize($path) === $asset['bytes'] ? file_get_contents($path) : false;
                    if ($cached === false || !self::matches($cached, $asset)) {
                        $bytes = $download($asset);
                        PackValidator::check(self::matches($bytes, $asset), __('The downloaded image does not match this package. Try again.', 'wconvert'));
                        $temporary = tempnam($this->directory, '.image-');
                        PackValidator::check($temporary !== false, __('The image could not be staged.', 'wconvert'));
                        $staged[$temporary] = $path;
                        PackValidator::check(file_put_contents($temporary, $bytes) === strlen($bytes), __('The image could not be staged.', 'wconvert'));
                    }
                    $urls[$asset['id']] = rtrim($this->baseUrl, '/') . '/' . $key;
                }
                // No package marker exists until all required bytes have passed.
                // Promoted orphan blobs after a disk failure are safe to reuse on retry.
                foreach ($staged as $temporary => $path) {
                    PackValidator::check(rename($temporary, $path), __('The image could not be installed.', 'wconvert'));
                    chmod($path, 0644);
                }
                $temporary = tempnam($this->directory . '/sets', '.set-');
                PackValidator::check($temporary !== false, __('The image package could not be staged.', 'wconvert'));
                $staged[$temporary] = $manifest;
                PackValidator::check(file_put_contents($temporary, $json) === strlen($json) && rename($temporary, $manifest), __('The image package could not be installed.', 'wconvert'));
            } finally {
                foreach ($staged as $temporary => $_) if (is_file($temporary)) unlink($temporary);
            }
            return $urls;
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }

    /** Read-only resolution. Never fetches or changes an installed package.
     * @param list<array<string, mixed>> $assets
     * @return array<string, string> */
    public function resolve(string $digest, array $assets): array
    {
        self::validate($assets);
        PackValidator::check(preg_match('/^[a-f0-9]{64}$/D', $digest) === 1, __('Invalid media package identity.', 'wconvert'));
        $marker = $this->directory . '/sets/' . $digest . '.json';
        PackValidator::check(!is_link($this->directory) && !is_link(dirname($marker)) && !is_link($marker)
            && is_file($marker) && file_get_contents($marker) === json_encode(['schema' => 1, 'assets' => $assets], JSON_THROW_ON_ERROR), __('Required pack images are missing. Preview the pack again to repair them.', 'wconvert'));
        $urls = [];
        foreach ($assets as $asset) {
            $key = self::key($asset); $path = $this->directory . '/' . $key;
            PackValidator::check(!is_link(dirname($path)) && !is_link($path) && is_file($path) && filesize($path) === $asset['bytes']
                && self::matches((string) file_get_contents($path), $asset), __('Required pack images are damaged. Preview the pack again to repair them.', 'wconvert'));
            $urls[$asset['id']] = rtrim($this->baseUrl, '/') . '/' . $key;
        }
        return $urls;
    }

    /** @param array<string, mixed> $asset */
    public static function key(array $asset): string
    {
        return $asset['access'] . '/' . $asset['sha256'] . '.' . self::TYPES[$asset['mime']];
    }

    /** @param list<array<string, mixed>> $assets */
    public static function validate(array $assets): void
    {
        PackValidator::check(array_is_list($assets) && count($assets) <= 16, __('Invalid image manifest.', 'wconvert'));
        $ids = []; $bytes = 0;
        foreach ($assets as $asset) {
            PackValidator::check(is_array($asset), __('Invalid image manifest.', 'wconvert'));
            PackValidator::keys($asset, ['id', 'sha256', 'mime', 'bytes', 'width', 'height', 'access']);
            PackValidator::check(PackValidator::identifier($asset['id'] ?? null) && !isset($ids[$asset['id']]), __('Invalid or repeated image identity.', 'wconvert'));
            $ids[$asset['id']] = true;
            PackValidator::check(is_string($asset['sha256'] ?? null) && preg_match('/^[a-f0-9]{64}$/D', $asset['sha256']) === 1
                && is_string($asset['mime'] ?? null) && isset(self::TYPES[$asset['mime']])
                && in_array($asset['access'] ?? null, ['free', 'premium'], true), __('Unsupported image format or access scope.', 'wconvert'));
            PackValidator::check(is_int($asset['bytes'] ?? null) && $asset['bytes'] > 0 && $asset['bytes'] <= self::MAX_BYTES, __('Image exceeds the download budget.', 'wconvert'));
            foreach (['width', 'height'] as $axis) PackValidator::check(is_int($asset[$axis] ?? null) && $asset[$axis] > 0 && $asset[$axis] <= 4096, __('Image exceeds the dimension budget.', 'wconvert'));
            $bytes += $asset['bytes'];
        }
        PackValidator::check($bytes <= 20971520, __('Images exceed the package budget.', 'wconvert'));
    }

    /** @param array<string, mixed> $asset */
    private static function matches(string $bytes, array $asset): bool
    {
        if (strlen($bytes) !== $asset['bytes'] || hash('sha256', $bytes) !== $asset['sha256']) return false;
        $info = @getimagesizefromstring($bytes);
        return $info !== false && $info['mime'] === $asset['mime'] && $info[0] === $asset['width'] && $info[1] === $asset['height'];
    }

    private function folder(string $path): void
    {
        PackValidator::check(!is_link($path) && (is_dir($path) || @mkdir($path, 0755, true)), __('The image folder is unavailable.', 'wconvert'));
    }
}

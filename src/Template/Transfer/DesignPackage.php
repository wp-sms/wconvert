<?php
namespace WConvert\Template\Transfer;

use WConvert\Template\Catalog\PackValidator;
use WConvert\Template\Catalog\VerifiedAssets;
use ZipArchive;

defined('ABSPATH') || exit;

/** One portable design. Archive bytes are never extracted using their own paths. */
final class DesignPackage
{
    public const MAX_ARCHIVE = 26214400;
    private const TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];

    /**
     * @param array<string, string> $art Exact SVG data URLs already supplied by this install, by digest. */
    public function __construct(private readonly PackValidator $validator, private readonly array $art = []) {}

    /**
     * @param array<string, mixed> $design
     *
     * @param callable(string): ?string $resolve Local image bytes, never a remote fetch.
     *
     * @param list<string> $omit
     */
    public function write(string $path, array $design, callable $resolve, array $omit = []): void
    {
        $design = array_intersect_key($design, array_flip(['name', 'display_type', 'tree', 'tokens']));
        $assets = []; $bindings = []; $bytes = []; $notes = []; $problems = [];
        foreach (DesignImages::slots($design) as $key => $slot) {
            DesignImages::put($design, $slot['path'], $slot['background'] ? 'none' : '');
            if ($slot['url'] === '') continue;
            /* translators: %s: the name of an image slot in the design, for example "Background image". */
            if (in_array($key, $omit, true)) { $notes[] = sprintf(__('Omitted: %s', 'wconvert'), DesignImages::label($design, $slot)); continue; }
            $digest = hash('sha256', $slot['url']);
            if (isset($this->art[$digest]) && $this->art[$digest] === $slot['url']) {
                $bindings[] = ['slot' => $key, 'asset' => 'art-' . $digest];
                continue;
            }
            $image = $resolve($slot['url']);
            // Silenced: malformed bytes warn as well as returning false, and the false is checked below.
            $info = is_string($image) ? @getimagesizefromstring($image) : false; // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- see above.
            if ($info === false || !isset(self::TYPES[$info['mime']]) || strlen($image) > VerifiedAssets::MAX_BYTES || max($info[0], $info[1]) > 4096) {
                $problems[$key] = DesignImages::label($design, $slot) . ': ' . __('Image is unavailable locally or is not a supported PNG, JPEG or WebP within the size limits.', 'wconvert');
                continue;
            }
            $digest = hash('sha256', $image);
            $id = substr($digest, 0, 32);
            $assets[$id] = ['id' => $id, 'sha256' => $digest, 'mime' => $info['mime'], 'bytes' => strlen($image), 'width' => $info[0], 'height' => $info[1], 'access' => 'free'];
            $bytes[$id] = $image;
            $bindings[] = ['slot' => $key, 'asset' => $id];
        }
        // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
        if ($problems !== []) throw new TransferProblems($problems);
        // Product references are site-local, even when numeric IDs coincide.
        foreach ($design['tree']['steps'] ?? [] as $i => $step) foreach ($step['results'] ?? [] as $j => $result) {
            if (($result['product_ids'] ?? []) !== []) $notes[] = __('Choose products on the receiving site.', 'wconvert');
            $design['tree']['steps'][$i]['results'][$j]['product_ids'] = [];
        }
        $wrapped = \WConvert\Template\TemplateTree::rewrittenIn(['template' => $design], static function (array $node) use (&$notes): array {
            if (($node['type'] ?? '') === 'products') {
                if (($node['source'] ?? 'selected') === 'cross_sells') $notes[] = __('Recommendations use cross-sells configured in WooCommerce on the receiving site.', 'wconvert');
                if (!empty($node['product_ids'])) $notes[] = __('Choose products on the receiving site.', 'wconvert');
                $node['product_ids'] = [];
                if (array_key_exists('main_product_id', $node)) {
                    $node['main_product_id'] = 0;
                    $notes[] = __('Choose the main product on the receiving site.', 'wconvert');
                }
                unset($node['context_key']);
            }
            return $node;
        });
        $design = $this->validator->portable($wrapped['template']);
        $document = ['format' => 'wconvert-design', 'schema' => 1, 'plugin' => WCONVERT_VERSION, 'design' => $design,
            'assets' => array_values($assets), 'bindings' => $bindings, 'notes' => array_values(array_unique($notes))];
        $this->validate($document);
        $json = (string) wp_json_encode($document, JSON_THROW_ON_ERROR);
        PackValidator::check(strlen($json) <= PackValidator::MAX_BYTES, __('This design document is too large.', 'wconvert'));
        $zip = self::open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        try {
            PackValidator::check($zip->addFromString('design.json', $json), __('Could not create the design file.', 'wconvert'));
            foreach ($assets as $asset) PackValidator::check($zip->addFromString(self::filename($asset), $bytes[$asset['id']]), __('Could not include an image.', 'wconvert'));
        } finally { PackValidator::check($zip->close(), __('Could not finish the design file.', 'wconvert')); }
    }

    /**
     * @return array<string, mixed> */
    public function read(string $path): array
    {
        PackValidator::check(is_file($path) && filesize($path) <= self::MAX_ARCHIVE, __('This design file is too large.', 'wconvert'));
        $zip = self::open($path);
        try {
            PackValidator::check($zip->numFiles >= 1 && $zip->numFiles <= 17, __('This design file contains too many files.', 'wconvert'));
            $names = []; $total = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                PackValidator::check(is_array($stat), __('The ZIP directory is invalid.', 'wconvert'));
                $name = $stat['name'];
                PackValidator::check(!isset($names[$name]) && ($name === 'design.json' || preg_match('~^images/[a-f0-9]{64}\.(png|jpg|webp)$~D', $name)), __('This design file contains an unexpected or duplicate entry.', 'wconvert'));
                $zip->getExternalAttributesIndex($i, $opsys, $attributes);
                PackValidator::check((($attributes >> 16) & 0170000) !== 0120000 && ($stat['encryption_method'] ?? 0) === 0, __('Encrypted files and symbolic links are not supported.', 'wconvert'));
                $limit = $name === 'design.json' ? PackValidator::MAX_BYTES : VerifiedAssets::MAX_BYTES;
                PackValidator::check($stat['size'] <= $limit, __('An entry in this file is too large.', 'wconvert'));
                $total += $stat['size']; $names[$name] = true;
            }
            PackValidator::check($total <= 20971520 + PackValidator::MAX_BYTES, __('This design file expands beyond the size limit.', 'wconvert'));
            $document = json_decode(self::entry($zip, 'design.json', PackValidator::MAX_BYTES), true, 48, JSON_THROW_ON_ERROR);
            PackValidator::check(is_array($document), __('This is not a design document.', 'wconvert'));
            $document = $this->validate($document);
            $expected = ['design.json' => true];
            foreach ($document['assets'] as $asset) {
                $expected[self::filename($asset)] = true;
                self::verify(self::entry($zip, self::filename($asset), VerifiedAssets::MAX_BYTES), $asset);
            }
            PackValidator::check(array_diff_key($names, $expected) === [] && array_diff_key($expected, $names) === [], __('The image manifest does not match this file.', 'wconvert'));
            return $document;
        } finally { $zip->close(); }
    }

    /**
     * @param array<string, mixed> $document
     * @return array<string, mixed> */
    private function validate(array $document): array
    {
        PackValidator::check(($document['format'] ?? null) === 'wconvert-design' && ($document['schema'] ?? null) === 1, __('Update WConvert or choose a supported WConvert design file.', 'wconvert'));
        PackValidator::keys($document, ['format', 'schema', 'plugin', 'design', 'assets', 'bindings', 'notes']);
        PackValidator::check(PackValidator::version($document['plugin'] ?? null) && is_array($document['design'] ?? null), __('This design has invalid metadata.', 'wconvert'));
        PackValidator::keys($document['design'], ['name', 'display_type', 'tree', 'tokens']);
        $document['design'] = $this->validator->portable($document['design']);
        PackValidator::check(is_array($document['assets'] ?? null), __('Invalid image manifest.', 'wconvert'));
        PackValidator::check(array_is_list($document['assets']), __('Invalid image manifest.', 'wconvert'));
        foreach ($document['assets'] as $asset) PackValidator::check(is_array($asset), __('Invalid image manifest.', 'wconvert'));
        VerifiedAssets::validate($document['assets']);
        $assets = [];
        foreach ($document['assets'] as $asset) {
            PackValidator::check($asset['id'] === substr($asset['sha256'], 0, 32) && isset(self::TYPES[$asset['mime']]), __('Invalid image identity.', 'wconvert'));
            $assets[$asset['id']] = true;
        }
        PackValidator::check(is_array($document['bindings'] ?? null) && array_is_list($document['bindings']) && count($document['bindings']) <= 400, __('Invalid image bindings.', 'wconvert'));
        $slots = DesignImages::slots($document['design']); $used = []; $bound = [];
        foreach ($document['bindings'] as $binding) {
            PackValidator::check(is_array($binding), __('Invalid image binding.', 'wconvert'));
            PackValidator::keys($binding, ['slot', 'asset']);
            $slot = $binding['slot'] ?? null; $id = $binding['asset'] ?? null;
            PackValidator::check(is_string($slot) && isset($slots[$slot]) && !isset($bound[$slot]) && is_string($id), __('Invalid or duplicate image binding.', 'wconvert'));
            PackValidator::check(isset($assets[$id]) || preg_match('/^art-[a-f0-9]{64}$/D', $id), __('An image binding names a missing image.', 'wconvert'));
            $bound[$slot] = true; $used[$id] = true;
        }
        PackValidator::check(array_diff_key($assets, $used) === [], __('The file contains unused images.', 'wconvert'));
        PackValidator::check(is_array($document['notes'] ?? null) && array_is_list($document['notes']) && count($document['notes']) <= 400, __('Invalid design notes.', 'wconvert'));
        foreach ($document['notes'] as $note) PackValidator::words($note, 500);
        return $document;
    }

    /**
     * @param array<string, mixed> $asset */
    public function image(string $path, array $asset): string
    {
        $zip = self::open($path);
        try { $bytes = self::entry($zip, self::filename($asset), VerifiedAssets::MAX_BYTES); self::verify($bytes, $asset); return $bytes; }
        finally { $zip->close(); }
    }

    /**
     * @return array<string, string> */
    public function art(): array
    {
        $urls = [];
        foreach ($this->art as $digest => $url) $urls['art-' . $digest] = $url;
        return $urls;
    }

    /**
     * @param array<string, mixed> $asset */
    private static function filename(array $asset): string { return 'images/' . $asset['sha256'] . '.' . self::TYPES[$asset['mime']]; }

    /**
     * @param array<string, mixed> $asset */
    private static function verify(string $bytes, array $asset): void
    {
        // Silenced: malformed bytes warn as well as returning false, and the false is checked below.
        $info = @getimagesizefromstring($bytes); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- see above.
        PackValidator::check(strlen($bytes) === $asset['bytes'] && hash('sha256', $bytes) === $asset['sha256'] && $info !== false
            && $info['mime'] === $asset['mime'] && $info[0] === $asset['width'] && $info[1] === $asset['height'], __('An image is damaged or does not match its manifest.', 'wconvert'));
    }

    private static function entry(ZipArchive $zip, string $name, int $limit): string
    {
        $stream = $zip->getStream($name);
        PackValidator::check(is_resource($stream), __('The design file is incomplete.', 'wconvert'));
        try { $bytes = stream_get_contents($stream, $limit + 1); }
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- closes a ZipArchive entry stream, not a file WP_Filesystem could open.
        finally { fclose($stream); }
        PackValidator::check(is_string($bytes) && strlen($bytes) <= $limit, __('An expanded file exceeds its size limit.', 'wconvert'));
        return $bytes;
    }

    private static function open(string $path, int $flags = 0): ZipArchive
    {
        PackValidator::check(class_exists(ZipArchive::class), __('This feature needs PHP ZIP support. Ask your host to enable it.', 'wconvert'));
        $zip = new ZipArchive();
        PackValidator::check($zip->open($path, $flags) === true, __('Could not read or create the design ZIP file.', 'wconvert'));
        return $zip;
    }
}

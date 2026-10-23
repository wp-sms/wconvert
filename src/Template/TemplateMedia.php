<?php

namespace WConvert\Template;

use WConvert\Template\Catalog\VerifiedAssets;
use WConvert\Template\Transfer\DesignImages;
use WP_Error;

defined('ABSPATH') || exit;

/** Adopt library artwork into WordPress only when a campaign draft is written. */
final class TemplateMedia
{
    private const DIGEST_META = '_wconvert_artwork_sha256';

    /** @param array<string, string> $roots Trusted artwork URL prefixes mapped to local directories. */
    public function __construct(private readonly array $roots = []) {}

    public static function forSite(): self
    {
        $uploads = wp_upload_dir(null, false);
        $roots = [
            rtrim(WCONVERT_URL, '/') . '/resources/template-artwork/' => WCONVERT_DIR . 'resources/template-artwork/',
            $uploads['baseurl'] . '/wconvert-template-images/free/' => $uploads['basedir'] . '/wconvert-template-images/free/',
            $uploads['baseurl'] . '/wconvert-template-images/premium/' => $uploads['basedir'] . '/wconvert-template-images/premium/',
        ];
        if (defined('WCONVERT_PRO_URL') && defined('WCONVERT_PRO_DIR')) {
            $roots[rtrim(WCONVERT_PRO_URL, '/') . '/resources/template-artwork/'] = WCONVERT_PRO_DIR . 'resources/template-artwork/';
        }
        return new self($roots);
    }

    /**
     * Ordinary merchant URLs, vector art and CSS decorations are not imports.
     * No network calls and no path outside the exact content-addressed roots.
     * @return array{path: string, digest: string, extension: string}|null
     */
    public function source(string $url): ?array
    {
        foreach ($this->roots as $prefix => $directory) {
            if (!str_starts_with($url, $prefix)) continue;
            $name = substr($url, strlen($prefix));
            if (!preg_match('/^([a-f0-9]{64})\.(png|jpg|webp)$/D', $name, $match)) return null;
            $root = realpath($directory);
            $path = realpath($directory . $name);
            if ($root === false || $path === false || dirname($path) !== $root || is_link($directory . $name)
                || !is_file($path) || !is_readable($path) || filesize($path) > VerifiedAssets::MAX_BYTES
                || hash_file('sha256', $path) !== $match[1]) {
                // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- a message for an administrator, caught in adopt() and returned as a WP_Error that the admin renders as text.
                throw new \RuntimeException(__('Template artwork is missing or damaged. Download the template again, or replace its image before saving.', 'wconvert'));
            }
            return ['path' => $path, 'digest' => $match[1], 'extension' => $match[2]];
        }
        return null;
    }

    /** @param array<string, mixed> $config
     * @return array<string, mixed>|WP_Error */
    public function adopt(array $config, string $name): array|WP_Error
    {
        if (!is_array($config['template'] ?? null)) return $config;
        $created = []; $lock = null;
        try {
            $design = $config['template']; $sources = [];
            foreach (DesignImages::slots($design) as $slot) {
                $source = $this->source($slot['url']);
                if ($source !== null) $sources[] = ['slot' => $slot, 'source' => $source];
            }
            if ($sources === []) return $config;
            require_once ABSPATH . 'wp-admin/includes/file.php';
            require_once ABSPATH . 'wp-admin/includes/media.php';
            require_once ABSPATH . 'wp-admin/includes/image.php';
            $uploads = wp_upload_dir();
            if ($uploads['error']) throw new \RuntimeException(__('WordPress could not open the uploads folder.', 'wconvert'));
            // One site-local lock makes parallel first uses reuse the same attachment.
            $folder = $uploads['basedir'] . '/wconvert-template-images';
            if (!wp_mkdir_p($folder) || is_link($folder) || is_link($folder . '/.media.lock')) throw new \RuntimeException(__('Template images could not be prepared.', 'wconvert'));
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- same atomic locking boundary as VerifiedAssets.
            $lock = fopen($folder . '/.media.lock', 'c');
            if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) throw new \RuntimeException(__('Another template is preparing images. Please save again in a moment.', 'wconvert'));
            $urls = [];
            foreach ($sources as ['slot' => $slot, 'source' => $source]) {
                $digest = $source['digest'];
                if (!isset($urls[$digest])) {
                    $id = $this->existing($digest);
                    if ($id === null) {
                        if (!current_user_can('upload_files')) throw new \RuntimeException(__('You need permission to upload images before using this template artwork.', 'wconvert'));
                        $mime = wp_get_image_mime($source['path']);
                        $expected = ['png' => 'image/png', 'jpg' => 'image/jpeg', 'webp' => 'image/webp'][$source['extension']];
                        if ($mime !== $expected || !in_array($mime, get_allowed_mime_types(), true)) throw new \RuntimeException(__('Your site does not allow this template image type.', 'wconvert'));
                        if (is_multisite() && filesize($source['path']) > get_upload_space_available()) throw new \RuntimeException(__('Your site does not have enough upload space.', 'wconvert'));
                        $temporary = wp_tempnam('wconvert-artwork');
                        if (!$temporary) throw new \RuntimeException(__('Template artwork could not be copied.', 'wconvert'));
                        try {
                            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_copy -- local verified bytes, staged for the WordPress sideload API.
                            if (!copy($source['path'], $temporary)) throw new \RuntimeException(__('Template artwork could not be copied.', 'wconvert'));
                            $title = 'WConvert — ' . $name . ' — ' . DesignImages::label($design, $slot);
                            $id = media_handle_sideload(['name' => 'wconvert-' . $digest . '.' . $source['extension'], 'tmp_name' => $temporary], 0, $title);
                            if ($id instanceof WP_Error) throw new \RuntimeException($id->get_error_message());
                            $created[] = $id;
                            if (!add_post_meta($id, self::DIGEST_META, $digest, true)) throw new \RuntimeException(__('Template artwork could not be registered.', 'wconvert'));
                        } finally {
                            if (is_file($temporary)) wp_delete_file($temporary);
                        }
                    }
                    $url = wp_get_attachment_url($id);
                    if (!$url) throw new \RuntimeException(__('Template artwork is unavailable in Media Library.', 'wconvert'));
                    $urls[$digest] = $url;
                }
                DesignImages::put($design, $slot['path'], $slot['background'] ? 'url("' . $urls[$digest] . '")' : $urls[$digest]);
            }
            $config['template'] = $design;
            return $config;
        } catch (\RuntimeException $error) {
            foreach ($created as $id) wp_delete_attachment($id, true);
            return new WP_Error('wconvert_template_media', $error->getMessage(), ['status' => 400]);
        } finally {
            if (is_resource($lock)) {
                flock($lock, LOCK_UN);
                // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose -- release the site-local lock.
                fclose($lock);
            }
        }
    }

    private function existing(string $digest): ?int
    {
        $ids = get_posts(['post_type' => 'attachment', 'post_status' => 'inherit', 'posts_per_page' => -1,
            'fields' => 'ids', 'meta_key' => self::DIGEST_META, 'meta_value' => $digest]);
        foreach ($ids as $id) {
            $file = get_attached_file((int) $id);
            if (is_string($file) && is_file($file) && wp_get_attachment_url((int) $id)) return (int) $id;
        }
        return null;
    }
}

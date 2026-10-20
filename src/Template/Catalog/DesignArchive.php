<?php

namespace WConvert\Template\Catalog;

use WConvert\Template\TemplateSource;

defined('ABSPATH') || exit;

/**
 * Installed designs and setups: immutable JSON files in uploads (ADR 0156).
 *
 * ============================================================================
 * THE FILE NAME IS A KEYED HASH, NOT THE PUBLIC DIGEST.
 * ============================================================================
 * The catalogue publishes every object's SHA-256, including premium ones. An
 * archive named by that digest let anyone who read the public index fetch a
 * site's premium JSON straight out of `uploads/`. Each file is named by
 * `HMAC(digest, site secret)` instead, so the name says nothing a visitor can
 * compute. A rotated secret is self-healing: a file whose bytes still verify
 * is renamed to its new name on the next read.
 *
 * ============================================================================
 * VALIDATED ONCE, THEN READ FROM A CACHE FILE.
 * ============================================================================
 * Every admin request used to re-validate every archived pack. The validated
 * result is now written beside the archive, keyed by the archive listing and
 * by everything that can change what validation says — the image store's
 * listing too, so a damaged image is noticed without re-hashing — the installed plan,
 * whether question journeys and commerce are registered, the plugin version
 * and the vocabulary itself. Deactivating Pro changes that key, so a design
 * the free reader would refuse is never served from a cache Pro filled.
 *
 * No file count is capped. Revisions an Optin still names are never deleted;
 * images are never deleted at all ({@see self::prune()}).
 *
 * The writes are PHP's own for the reason {@see VerifiedAssets} gives: a
 * staged file renamed within one folder is the only way a reader never sees
 * half an object, and WP_Filesystem's move() is a copy and a delete on an FTP
 * or SSH install.
 */
final class DesignArchive implements TemplateSource
{
    // phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and rendered as text.
    // phpcs:disable WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents, WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents, WordPress.WP.AlternativeFunctions.rename_rename -- local files inside this site; see the class note.
    private const KINDS = ['designs', 'setups', 'index'];

    /** @var array{designs: list<array<string, mixed>>, setups: list<array<string, mixed>>}|null */
    private ?array $snapshot = null;

    /**
     * @param string|\Closure(): string $fingerprint the configuration validation depends on; a closure so building this reads nothing
     * @param array<string, int> $bundledRevisions revision of each design this ZIP ships, by id
     * @param \Closure(): list<string>|null $referenced template and playbook ids any Optin row still names
     */
    public function __construct(
        private readonly string $directory,
        private readonly PackValidator $validator,
        private readonly string $secret,
        private readonly ?VerifiedAssets $assets = null,
        private readonly string|\Closure $fingerprint = '',
        private readonly array $bundledRevisions = [],
        private readonly ?\Closure $referenced = null,
    ) {
    }

    /** The template id an installed revision registers under. */
    public static function templateId(string $id, int $revision): string
    {
        return 'design-' . $revision . '-' . $id;
    }

    public static function setupId(string $id, int $revision): string
    {
        return 'setup-' . $revision . '-' . $id;
    }

    /** @return list<array<string, mixed>> */
    public function entries(): array
    {
        return array_map(static fn (array $design): array => $design['template'], $this->snapshot()['designs']);
    }

    /**
     * Every installed design revision, newest first per id.
     *
     * Each is `{id, revision, sha256, family, meta, template}`.
     *
     * @return list<array<string, mixed>>
     */
    public function designs(): array
    {
        return $this->snapshot()['designs'];
    }

    /**
     * Installed setups whose pinned design is here, as Playbook entries. Only
     * the highest installed revision of each setup offers a new campaign.
     *
     * @return list<array<string, mixed>>
     */
    public function playbooks(): array
    {
        $seen = []; $entries = [];
        foreach ($this->snapshot()['setups'] as $setup) {
            if (isset($seen[$setup['id']])) continue;
            $seen[$setup['id']] = true;
            $entries[] = $setup['playbook'];
        }
        return $entries;
    }

    /** @return array<string, int> highest installed revision by design id */
    public function revisions(): array
    {
        $revisions = [];
        foreach ($this->designs() as $design) $revisions[$design['id']] = max($revisions[$design['id']] ?? 0, $design['revision']);
        return $revisions;
    }

    /** @return array<string, int> highest installed revision by setup id */
    public function setupRevisions(): array
    {
        $revisions = [];
        foreach ($this->snapshot()['setups'] as $setup) $revisions[$setup['id']] = max($revisions[$setup['id']] ?? 0, $setup['revision']);
        return $revisions;
    }

    public function hasDesign(string $id, int $revision): bool
    {
        foreach ($this->designs() as $design) if ($design['id'] === $id && $design['revision'] === $revision) return true;
        return false;
    }

    /**
     * The raw object bytes for an installed digest, if this archive holds it.
     */
    public function object(string $kind, string $sha256): ?string
    {
        PackValidator::check(in_array($kind, self::KINDS, true) && CatalogIndex::digest($sha256), __('Invalid archive request.', 'wconvert'));
        $path = $this->path($kind, $sha256);
        if (!is_file($path) || is_link($path)) return null;
        $json = file_get_contents($path);
        return is_string($json) && hash_equals($sha256, hash('sha256', $json)) ? $json : null;
    }

    /** Store verified bytes. Same bytes are idempotent; a different digest is a different file. */
    public function store(string $kind, string $sha256, string $json): void
    {
        PackValidator::check(in_array($kind, self::KINDS, true) && hash_equals($sha256, hash('sha256', $json)), __('The downloaded design did not match the catalog. Refresh and try again.', 'wconvert'));
        $folder = $this->directory . '/' . $kind;
        PackValidator::check(!is_link($this->directory) && !is_link($folder) && wp_mkdir_p($folder), __('The template folder could not be created. Check uploads permissions and retry.', 'wconvert'));
        // Asked first because tempnam() does not fail on an unwritable folder:
        // it falls back to the system temp directory, and the rename() below
        // would then be a move across filesystems.
        PackValidator::check(wp_is_writable($folder), __('The design could not be written.', 'wconvert'));
        $path = $this->path($kind, $sha256);
        if ($this->object($kind, $sha256) !== null) return;
        $temporary = tempnam($folder, '.object-');
        PackValidator::check($temporary !== false, __('The design could not be written.', 'wconvert'));
        try {
            PackValidator::check(file_put_contents($temporary, $json, LOCK_EX) === strlen($json), __('The design could not be written.', 'wconvert'));
            PackValidator::check(rename($temporary, $path), __('The design could not be installed.', 'wconvert'));
        } finally {
            if (is_file($temporary)) wp_delete_file($temporary);
        }
        if ($kind !== 'index') $this->snapshot = null;
    }

    /**
     * Prepare a design's images without registering it: preview downloads
     * cache them so the install that follows needs no second fetch.
     *
     * @param array<string, mixed> $pack strict internal pack
     * @param callable(array<string, mixed>): string $download
     */
    public function prepareImages(array $pack, string $digest, callable $download): void
    {
        if ($pack['assets'] === []) return;
        PackValidator::check($this->assets !== null, __('Image installation is unavailable.', 'wconvert'));
        $this->assets->install($digest, $pack['assets'], $download);
    }

    /**
     * Resolve verified local images into a strict pack. Normal reads never fetch.
     *
     * @param array<string, mixed> $pack
     * @return array<string, mixed>
     */
    public function withImages(array $pack, string $digest): array
    {
        if ($pack['assets'] === []) return $pack;
        PackValidator::check($this->assets !== null, __('Image installation is unavailable.', 'wconvert'));
        return PackImages::hydrate($pack, $this->assets->resolve($digest, $pack['assets']));
    }

    /**
     * Delete installed revisions nothing needs.
     *
     * A revision stays while it is the newest of its design, while any Optin
     * row names it in `config` or `published_config` — drafts, published,
     * trashed and every A/B variant alike — or while an installed setup pins
     * it. Index pages outside `$keepIndex` go. Images are never deleted: an
     * Optin's snapshot holds their URLs, not the archive.
     *
     * @param list<string> $keepIndex digests of the current release's index files
     */
    public function prune(array $keepIndex = []): int
    {
        if ($this->referenced === null) return 0;
        $referenced = array_flip(($this->referenced)());
        $newest = $this->revisions();
        $setupNewest = $this->setupRevisions();
        $pinned = [];
        foreach ($this->snapshot()['setups'] as $setup) {
            if ($setup['revision'] === ($setupNewest[$setup['id']] ?? 0) || isset($referenced[$setup['playbook']['id']])) $pinned[$setup['design']['id'] . '@' . $setup['design']['revision']] = true;
        }
        $deleted = 0;
        foreach ($this->designs() as $design) {
            $keep = $design['revision'] === $newest[$design['id']] || isset($referenced[$design['template']['id']]) || isset($pinned[$design['id'] . '@' . $design['revision']]);
            if (!$keep && $this->remove('designs', $design['sha256'])) $deleted++;
        }
        foreach ($this->snapshot()['setups'] as $setup) {
            if ($setup['revision'] !== $setupNewest[$setup['id']] && $this->remove('setups', $setup['sha256'])) $deleted++;
        }
        if ($keepIndex !== []) {
            $keep = array_flip(array_map(fn (string $sha): string => basename($this->path('index', $sha)), $keepIndex));
            foreach (glob($this->directory . '/index/*.json') ?: [] as $file) {
                if (!isset($keep[basename($file)]) && !is_link($file)) wp_delete_file($file);
            }
        }
        if ($deleted > 0) $this->snapshot = null;
        return $deleted;
    }

    /** @return array{designs: list<array<string, mixed>>, setups: list<array<string, mixed>>} */
    private function snapshot(): array
    {
        if ($this->snapshot !== null) return $this->snapshot;
        $files = [];
        foreach (['designs', 'setups'] as $kind) {
            foreach (glob($this->directory . '/' . $kind . '/*.json') ?: [] as $file) {
                if (!is_link($file)) $files[] = $kind . '/' . basename($file) . ':' . (int) filesize($file) . ':' . (int) filemtime($file);
            }
        }
        sort($files);
        $key = hash_hmac('sha256', (string) wp_json_encode([$files, $this->assets?->listing() ?? [], $this->fingerprint instanceof \Closure ? ($this->fingerprint)() : $this->fingerprint, $this->bundledRevisions]), $this->secret);
        $cache = $this->directory . '/cache/' . $key . '.json';
        if (is_file($cache) && !is_link($cache)) {
            $cached = json_decode((string) file_get_contents($cache), true, 512);
            if (is_array($cached) && is_array($cached['designs'] ?? null) && is_array($cached['setups'] ?? null)) {
                return $this->snapshot = ['designs' => self::rows($cached['designs']), 'setups' => self::rows($cached['setups'])];
            }
        }
        $snapshot = $this->validateAll();
        $this->writeCache($cache, $snapshot);
        return $this->snapshot = $snapshot;
    }

    /** @return array{designs: list<array<string, mixed>>, setups: list<array<string, mixed>>} */
    private function validateAll(): array
    {
        $designs = []; $packs = [];
        foreach ($this->read('designs') as $sha => $json) {
            try {
                $object = DesignObject::design($json, $sha);
                $pack = $object['pack'];
                $validated = $this->withImages($this->validator->validate($pack), $sha);
                $template = $validated['templates'][0];
                $template['design_key'] = 'registered:' . $object['design']['id'];
                $template['revision'] = $object['design']['revision'];
                $template['id'] = self::templateId($object['design']['id'], $object['design']['revision']);
                $designs[] = $object['design'] + ['template' => $template];
                $packs[$object['design']['id'] . '@' . $object['design']['revision']] = $pack;
            } catch (\RuntimeException $error) {
                // A corrupt or no-longer-readable file must not take the library down.
                continue;
            }
        }
        usort($designs, static fn (array $a, array $b): int => [$a['id'], $b['revision']] <=> [$b['id'], $a['revision']]);
        $setups = [];
        foreach ($this->read('setups') as $sha => $json) {
            try {
                $pin = json_decode($json, true, 48)['design'] ?? null;
                // Installing a setup always archives its pinned design too, even
                // one this ZIP bundles at the same revision, so a setup is
                // validated against the exact tree its words were written for.
                $designPack = is_array($pin) ? $packs[($pin['id'] ?? '') . '@' . ($pin['revision'] ?? '')] ?? null : null;
                if ($designPack === null) continue;
                $object = DesignObject::setup($json, $sha, $designPack, $pin['revision']);
                $validated = $this->validator->validate($object['pack']);
                $playbook = $validated['playbooks'][0];
                $playbook['id'] = self::setupId($object['setup']['id'], $object['setup']['revision']);
                $playbook['template_id'] = self::templateId($pin['id'], $pin['revision']);
                $playbook['design_key'] = 'registered:' . $pin['id'];
                $setups[] = $object['setup'] + ['design' => ['id' => $pin['id'], 'revision' => $pin['revision']], 'playbook' => $playbook];
            } catch (\RuntimeException $error) {
                continue;
            }
        }
        usort($setups, static fn (array $a, array $b): int => [$a['id'], $b['revision']] <=> [$b['id'], $a['revision']]);
        return ['designs' => $designs, 'setups' => $setups];
    }

    /** @return array<string, string> verified bytes by digest */
    private function read(string $kind): array
    {
        $objects = [];
        foreach (glob($this->directory . '/' . $kind . '/*.json') ?: [] as $file) {
            if (is_link($file) || !is_readable($file) || filesize($file) > PackValidator::MAX_BYTES) continue;
            $json = file_get_contents($file);
            if (!is_string($json)) continue;
            $sha = hash('sha256', $json);
            $expected = $this->path($kind, $sha);
            if ($file !== $expected) {
                // A rotated secret renames, it never orphans: the bytes are the identity.
                if (preg_match('/^[a-f0-9]{64}\.json$/D', basename($file)) === 1 && !is_file($expected)) @rename($file, $expected); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a failed rename leaves the file readable under its old name.
                elseif (is_file($expected)) continue;
            }
            $objects[$sha] = $json;
        }
        return $objects;
    }

    /** @param array<string, mixed> $snapshot */
    private function writeCache(string $cache, array $snapshot): void
    {
        $folder = dirname($cache);
        if (is_link($folder) || !wp_mkdir_p($folder) || !wp_is_writable($folder)) return;
        foreach (glob($folder . '/*.json') ?: [] as $stale) if ($stale !== $cache && !is_link($stale)) wp_delete_file($stale);
        $temporary = tempnam($folder, '.cache-');
        if ($temporary === false) return;
        $json = (string) wp_json_encode($snapshot);
        if (file_put_contents($temporary, $json, LOCK_EX) === strlen($json)) @rename($temporary, $cache); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged -- a cache that fails to land is rebuilt next request.
        if (is_file($temporary)) wp_delete_file($temporary);
    }

    /**
     * @param array<mixed> $rows
     * @return list<array<string, mixed>>
     */
    private static function rows(array $rows): array
    {
        $list = [];
        foreach ($rows as $row) if (is_array($row)) $list[] = $row;
        /** @var list<array<string, mixed>> $list */
        return $list;
    }

    private function remove(string $kind, string $sha256): bool
    {
        $path = $this->path($kind, $sha256);
        if (!is_file($path) || is_link($path)) return false;
        wp_delete_file($path);
        clearstatcache(true, $path);
        return !file_exists($path);
    }

    private function path(string $kind, string $sha256): string
    {
        return $this->directory . '/' . $kind . '/' . hash_hmac('sha256', $sha256, $this->secret) . '.json';
    }
    // phpcs:enable
}

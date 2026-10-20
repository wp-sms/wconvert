<?php

namespace WConvert\Template\Catalog;

use WConvert\Goal\Goal;
use WConvert\Storage\OptionStore;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * The hosted template library, read one design at a time (ADR 0156).
 *
 * ============================================================================
 * NOTHING IS FETCHED UNTIL AN ADMINISTRATOR SAYS YES.
 * ============================================================================
 * The library is on by default, and gated twice before it touches the network
 * (wp.org Guideline 7). The site can switch it off entirely — the
 * `WCONVERT_TEMPLATE_CATALOG` constant, the `wconvert_template_catalog` filter
 * or an empty catalogue address — and an administrator must have answered
 * the one-time question in the picker (or turned it on in Settings). Then a
 * refresh happens only inside an admin request that asked for one, at most
 * every twelve hours: never on activation, from cron, on the dashboard or on
 * the front end. Normal library reads use local copies only.
 *
 * Every design is its own object and fails on its own: one unreadable entry
 * or one refused download costs that design, never the rest.
 */
final class TemplateCatalog
{
    // phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
    public const CACHE_OPTION = 'wconvert_template_catalog_cache';
    public const SOURCE_OPTION = 'wconvert_template_catalog_url';
    public const CONSENT_OPTION = 'wconvert_template_library_consent';
    public const BACKOFF_TRANSIENT = 'wconvert_template_catalog_backoff';
    /** Trusted download origin is independent of an administrator's catalogue override. */
    public const DEFAULT_ORIGIN = 'https://templates.wconvert.io';
    /** The major version is in the address, so a v4 service can sit beside this reader. */
    public const DEFAULT_SOURCE = self::DEFAULT_ORIGIN . '/v3/manifest.json';
    public const REFRESH_INTERVAL = 43200;
    /** One refresh, every request in it, in wall-clock seconds. */
    public const BUDGET_SECONDS = 20;
    public const MAX_BATCH = 50;
    /** Availability of one catalogue entry on this site, strongest reason first. */
    public const STATES = ['unavailable', 'locked', 'update_plugin', 'install', 'ready'];

    private const EMPTY_INDEX = ['designs' => [], 'revisions' => [], 'setups' => [], 'collections' => [], 'taxonomy' => [], 'popularity' => [], 'skipped' => 0];

    /** @var array{designs: list<array<string, mixed>>, revisions: list<array<string, mixed>>, setups: list<array<string, mixed>>, collections: list<array<string, mixed>>, taxonomy: array<string, mixed>, popularity: array<string, int>, skipped: int}|null */
    private ?array $index = null;

    /**
     * @param \Closure(): array<string, int> $localRevisions highest revision this site already holds, by design id (bundled or installed)
     * @param \Closure(): array<string, bool> $plugins which prerequisite plugins this site runs
     * @param \Closure(): int $clock
     * @param array<string, list<string>>|\Closure(): array<string, list<string>> $facetVocabulary
     * @param string|\Closure(): string $locale
     *
     * The last two may be closures because this is built while routes are
     * registered, on every request, and neither the manifest nor the locale
     * may be read then.
     */
    public function __construct(
        private readonly OptionStore $options,
        private readonly CatalogTransport $transport,
        private readonly PackValidator $validator,
        private readonly DesignArchive $archive,
        private readonly Tier $installedTier = Tier::Free,
        private readonly ?\Closure $localRevisions = null,
        private readonly ?\Closure $plugins = null,
        private readonly ?\Closure $clock = null,
        private readonly array|\Closure $facetVocabulary = [],
        private readonly string|\Closure $locale = 'en_US',
    ) {
    }

    /**
     * Whether this site may use the hosted library at all. Checking never
     * makes a network request.
     */
    public static function enabled(OptionStore $options): bool
    {
        if (defined('WCONVERT_TEMPLATE_CATALOG') && !constant('WCONVERT_TEMPLATE_CATALOG')) return false;
        return (bool) apply_filters('wconvert_template_catalog', true) && self::sourceIn($options) !== '';
    }

    /** Kept for the admin boot data, which says whether to draw the library at all. */
    public static function configured(OptionStore $options): bool
    {
        return self::enabled($options);
    }

    /** @return 'unanswered'|'yes'|'no' */
    public function consent(): string
    {
        $value = $this->options->get(self::CONSENT_OPTION, '');
        return in_array($value, ['yes', 'no'], true) ? $value : 'unanswered';
    }

    /** @return array<string, mixed> */
    public function setConsent(bool $allowed): array
    {
        $this->options->set(self::CONSENT_OPTION, $allowed ? 'yes' : 'no');
        return $this->status();
    }

    /**
     * Everything the picker needs about the hosted library, from local state.
     *
     * @return array<string, mixed>
     */
    public function status(): array
    {
        $cache = $this->cache();
        // Switched off, or the answer is no: the cached index stays on disk
        // but offers nothing, so turning the library off takes effect at once.
        $index = self::enabled($this->options) && $this->consent() === 'yes' ? $this->index() : self::EMPTY_INDEX;
        $designs = []; $setups = [];
        foreach ($index['designs'] as $entry) {
            if ($this->isWithdrawn($entry['id'], $entry['revision'])) continue;
            $designs[] = $this->card($entry, $index['popularity'][$entry['id']] ?? null);
        }
        $setupRevisions = $this->archive->setupRevisions();
        foreach ($index['setups'] as $entry) {
            $design = $this->designOf($entry);
            if ($design === null || $this->isWithdrawn($design['id'], $design['revision'])) continue;
            $state = Goal::tryFrom($entry['goal']) === null ? 'update_plugin'
                : $this->state($entry['tier'], $design['format'], $entry['requires'], $entry['prerequisites'], ($setupRevisions[$entry['id']] ?? 0) >= $entry['revision']);
            $setups[] = ['id' => $entry['id'], 'revision' => $entry['revision'], 'sha256' => $entry['sha256'], 'name' => $entry['name'], 'goal' => $entry['goal'],
                'tier' => $entry['tier'], 'design' => $entry['design'], 'state' => $state];
        }
        return [
            'enabled' => self::enabled($this->options), 'consent' => $this->consent(), 'source' => $this->source(),
            'checked_at' => $cache['checked_at'] ?? null, 'release' => $cache['release'] ?? null,
            // A newer major lives at another address; this reader only says so.
            'update_required' => ($cache['latest_major'] ?? CatalogIndex::MAJOR) > CatalogIndex::MAJOR || ($cache['files']['truncated'] ?? false) === true,
            'skipped' => $index['skipped'], 'taxonomy' => $index['taxonomy'], 'withdrawn' => $cache['withdrawn'] ?? [],
            'designs' => $designs, 'setups' => $setups,
        ];
    }

    /**
     * Refresh the local index. `$ifStale` is what opening the picker sends:
     * it does nothing inside the twelve-hour window or without consent.
     *
     * @return array<string, mixed>
     */
    public function refresh(bool $ifStale = false): array
    {
        $cache = $this->cache();
        if ($ifStale && ($this->consent() !== 'yes' || !self::enabled($this->options)
            || ($this->now() - strtotime((string) ($cache['checked_at'] ?? '@0'))) < self::REFRESH_INTERVAL)) return $this->status();
        PackValidator::check(self::enabled($this->options), __('The online template library is switched off on this site.', 'wconvert'));
        PackValidator::check($this->consent() === 'yes', __('Allow online designs first. Your local library has not changed.', 'wconvert'));
        $retry = (int) get_transient(self::BACKOFF_TRANSIENT);
        PackValidator::check($retry <= $this->now(), sprintf(/* translators: %d: seconds */ __('The template library was unreachable a moment ago. Try again in %d seconds. Installed designs are still available.', 'wconvert'), max(1, $retry - $this->now())));
        $started = $this->now();
        try {
            $this->read($cache, $started);
        } catch (\RuntimeException $error) {
            set_transient(self::BACKOFF_TRANSIENT, $this->now() + 300, 300);
            if (defined('WP_HTTP_BLOCK_EXTERNAL') && WP_HTTP_BLOCK_EXTERNAL) {
                throw new \RuntimeException(__('This site blocks outgoing requests (WP_HTTP_BLOCK_EXTERNAL). Add templates.wconvert.io to WP_ACCESSIBLE_HOSTS to use online designs. Installed designs are still available.', 'wconvert'), 0, $error);
            }
            throw $error;
        }
        $this->index = null;
        return $this->status();
    }

    /**
     * Download and validate one design without registering it, for the
     * inspection view. Its images are cached so the install needs no refetch.
     *
     * @return array<string, mixed>
     */
    public function preview(string $id): array
    {
        $entry = $this->entry($id);
        [$json, $pack] = $this->fetchDesign($entry);
        $validated = $this->archive->withImages($this->validator->validate($pack), $entry['sha256']);
        $template = $validated['templates'][0];
        $template['id'] = DesignArchive::templateId($entry['id'], $entry['revision']);
        unset($json);
        return ['id' => $entry['id'], 'revision' => $entry['revision'], 'sha256' => $entry['sha256'], 'name' => $entry['name'], 'template' => $template];
    }

    /**
     * Install one design revision. The digest is the one the merchant
     * inspected, so a release that changed in between is refused.
     *
     * @return array{template_id: string, status: array<string, mixed>}
     */
    public function install(string $id, string $sha256): array
    {
        $entry = $this->entry($id);
        PackValidator::check(hash_equals($entry['sha256'], $sha256), __('This design changed after you previewed it. Preview it again before installing.', 'wconvert'));
        $this->installEntries([$entry], []);
        return ['template_id' => DesignArchive::templateId($entry['id'], $entry['revision']), 'status' => $this->status()];
    }

    /**
     * Install a setup: its words and rules, the exact design revision it pins
     * and that design's images, under one premium pass when any is premium.
     *
     * @return array{playbook_id: string, template_id: string, status: array<string, mixed>}
     */
    public function installSetup(string $id, string $sha256): array
    {
        $index = $this->index();
        $setup = null;
        foreach ($index['setups'] as $candidate) if ($candidate['id'] === $id) $setup = $candidate;
        PackValidator::check($setup !== null, __('This campaign setup is no longer listed. Refresh the library.', 'wconvert'));
        PackValidator::check(hash_equals($setup['sha256'], $sha256), __('This campaign setup changed after you previewed it. Preview it again before installing.', 'wconvert'));
        $design = $this->designOf($setup);
        PackValidator::check($design !== null, __('The design this setup uses is no longer listed. Refresh the library.', 'wconvert'));
        PackValidator::check(!$this->isWithdrawn($design['id'], $design['revision']), __('The design this setup uses has been withdrawn.', 'wconvert'));
        $result = ['playbook_id' => DesignArchive::setupId($setup['id'], $setup['revision']), 'template_id' => DesignArchive::templateId($design['id'], $design['revision'])];
        // Installing what is already installed is a no-op, not an error.
        if ($this->archive->object('setups', $setup['sha256']) !== null && $this->archive->object('designs', $design['sha256']) !== null) return $result + ['status' => $this->status()];
        PackValidator::check($this->state($setup['tier'], $design['format'], $setup['requires'], $setup['prerequisites'], false) === 'install', __('This campaign setup cannot be installed on this site.', 'wconvert'));
        $this->installEntries($this->archive->object('designs', $design['sha256']) === null ? [$design] : [], [$setup]);
        return $result + ['status' => $this->status()];
    }

    /**
     * Designs this site was told to stop offering. A withdrawn design leaves
     * the picker; an Optin already using one keeps its copy and gets a notice.
     *
     * @return list<array{id: string, revision: int|null, reason: string}>
     */
    public function withdrawn(): array
    {
        return $this->cache()['withdrawn'] ?? [];
    }

    public function isWithdrawn(string $id, int $revision): bool
    {
        foreach ($this->withdrawn() as $row) {
            if ($row['id'] === $id && ($row['revision'] === null || $row['revision'] === $revision)) return true;
        }
        return false;
    }

    /**
     * Collections whose installed setups this site holds. Only an installed
     * setup can be a starting point; the rest of a collection is discovery.
     *
     * @return list<array<string, mixed>>
     */
    public function collections(): array
    {
        if (!self::enabled($this->options) || $this->consent() !== 'yes') return [];
        $installed = $this->archive->setupRevisions();
        $collections = [];
        foreach ($this->index()['collections'] as $collection) {
            $items = [];
            foreach ($collection['items'] as $item) {
                if (isset($item['setup'], $installed[$item['setup']])) $items[] = ['setup_id' => DesignArchive::setupId($item['setup'], $installed[$item['setup']]), 'stage' => $item['stage']];
            }
            if ($items === []) continue;
            $collection['items'] = $items;
            $collection['id'] = 'catalog-' . $collection['id'];
            $collections[] = $collection;
        }
        return $collections;
    }

    /**
     * Remote designs as picker cards, with this site's availability for each.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    private function card(array $entry, ?int $popularity): array
    {
        $local = $this->local()[$entry['id']] ?? 0;
        $base = $this->base();
        $thumb = $entry['thumb'] === null ? null : ['1x' => $base . 'thumbs/' . $entry['thumb'] . '.webp', '2x' => $base . 'thumbs/' . $entry['thumb'] . '@2x.webp'];
        return [
            'id' => $entry['id'], 'revision' => $entry['revision'], 'sha256' => $entry['sha256'], 'name' => $entry['name'],
            'format' => $entry['format'], 'tier' => $entry['tier'], 'family' => $entry['family'], 'aliases' => $entry['aliases'],
            'slug' => $entry['slug'], 'tags' => $entry['tags'], 'facets' => $entry['facets'], 'prerequisites' => $entry['prerequisites'],
            'thumbnail' => $thumb, 'popularity' => $popularity, 'local_revision' => $local ?: null,
            'state' => $this->state($entry['tier'], $entry['format'], $entry['requires'], $entry['prerequisites'], $local >= $entry['revision']),
        ];
    }

    /**
     * The one place a catalogue entry's availability is decided, strongest
     * reason first: a missing plugin, then Pro, then this plugin's version,
     * then whether it is already here.
     *
     * @param array{plugin: string, capabilities: list<string>} $requires
     * @param list<string> $prerequisites
     */
    private function state(string $tier, string $format, array $requires, array $prerequisites, bool $local): string
    {
        $plugins = $this->plugins !== null ? ($this->plugins)() : [];
        foreach ($prerequisites as $plugin) {
            if (($plugins[$plugin] ?? false) !== true) return 'unavailable';
        }
        $known = Tier::tryFrom($tier);
        if ($known !== null && !$this->installedTier->includes($known)) return 'locked';
        // An unknown plan, format or capability is a word a newer WConvert
        // knows: "update the plugin", never quietly "free".
        if ($known === null || !in_array($format, DesignObject::FORMATS, true) || ($known === Tier::Free && !in_array($format, ['inline', 'popup'], true))
            || version_compare(WCONVERT_VERSION, $requires['plugin'], '<') || array_diff($requires['capabilities'], PackValidator::CAPABILITIES) !== []) return 'update_plugin';
        return $local ? 'ready' : 'install';
    }

    /**
     * @param list<array<string, mixed>> $designs
     * @param list<array<string, mixed>> $setups
     */
    private function installEntries(array $designs, array $setups): void
    {
        PackValidator::check(count($designs) + count($setups) <= self::MAX_BATCH, __('Install fewer designs at once.', 'wconvert'));
        // Every refusal this site can decide on its own comes before any pass is asked for.
        foreach ($designs as $entry) $this->installable($entry);
        $premiumDesigns = array_values(array_map(static fn (array $entry): string => $entry['sha256'], array_filter($designs, static fn (array $entry): bool => $entry['tier'] !== 'free')));
        $premiumSetups = array_values(array_map(static fn (array $entry): string => $entry['sha256'], array_filter($setups, static fn (array $entry): bool => $entry['tier'] !== 'free')));
        if ($premiumDesigns !== [] || $premiumSetups !== []) {
            PackValidator::check($this->transport instanceof CatalogPremiumTransport, __('WConvert Pro is needed to download this design.', 'wconvert'));
            $this->transport->authorize($premiumDesigns, $premiumSetups);
        }
        $fetched = [];
        foreach ($designs as $entry) {
            [$json, $pack] = $this->fetchDesign($entry, true);
            $this->validator->validate($pack);
            $fetched[] = [$entry['sha256'], $json];
        }
        $setupObjects = [];
        foreach ($setups as $entry) {
            $json = $entry['tier'] === 'free'
                ? $this->transport->get($this->base() . 'setups/' . $entry['sha256'] . '.json')
                : $this->premium('premium/setups/' . $entry['sha256'] . '.json', PackValidator::MAX_BYTES);
            $designJson = $this->archive->object('designs', $this->designFor($entry)['sha256']);
            foreach ($fetched as [$sha, $bytes]) if ($sha === $this->designFor($entry)['sha256']) $designJson = $bytes;
            PackValidator::check(is_string($designJson), __('The design this setup uses could not be installed.', 'wconvert'));
            $design = DesignObject::design($designJson, $this->designFor($entry)['sha256']);
            $object = DesignObject::setup($json, $entry['sha256'], $design['pack'], $entry['design']['revision']);
            $this->validator->validate($object['pack']);
            $setupObjects[] = [$entry['sha256'], $json];
        }
        // Write only after every object in the batch validated.
        foreach ($fetched as [$sha, $json]) $this->archive->store('designs', $sha, $json);
        foreach ($setupObjects as [$sha, $json]) $this->archive->store('setups', $sha, $json);
        $this->archive->prune();
    }

    /**
     * @param array<string, mixed> $entry
     * @return array{0: string, 1: array<string, mixed>} bytes and the strict pack, images prepared
     */
    private function fetchDesign(array $entry, bool $authorized = false): array
    {
        $this->installable($entry);
        $json = $this->archive->object('designs', $entry['sha256']);
        if ($json === null) {
            if ($entry['tier'] === 'free') {
                $json = $this->transport->get($this->base() . 'designs/' . $entry['sha256'] . '.json');
            } else {
                PackValidator::check($this->transport instanceof CatalogPremiumTransport, __('WConvert Pro is needed to download this design.', 'wconvert'));
                if (!$authorized) $this->transport->authorize([$entry['sha256']], []);
                $json = $this->premium('premium/designs/' . $entry['sha256'] . '.json', PackValidator::MAX_BYTES);
            }
        }
        $object = DesignObject::design($json, $entry['sha256']);
        PackValidator::check($object['design']['id'] === $entry['id'] && $object['design']['revision'] === $entry['revision'], __('The downloaded design has the wrong identity.', 'wconvert'));
        $pack = $object['pack'];
        $this->archive->prepareImages($pack, $entry['sha256'], function (array $asset): string {
            PackValidator::check($this->transport instanceof CatalogImageTransport, __('Image installation is unavailable.', 'wconvert'));
            $file = $asset['sha256'] . '.' . pathinfo(VerifiedAssets::key($asset), PATHINFO_EXTENSION);
            if ($asset['access'] === 'free') return $this->transport->image($this->base() . 'assets/' . $file, $asset['bytes']);
            return $this->premium('premium/assets/' . $file, $asset['bytes']);
        });
        return [$json, $pack];
    }

    /** @param array<string, mixed> $entry */
    private function installable(array $entry): void
    {
        $state = $this->state($entry['tier'], $entry['format'], $entry['requires'], $entry['prerequisites'], false);
        PackValidator::check($state === 'install', $state === 'locked'
            ? __('WConvert Pro is needed to download this design.', 'wconvert')
            : __('This design cannot be used on this site.', 'wconvert'));
    }

    private function premium(string $path, int $limit): string
    {
        PackValidator::check($this->transport instanceof CatalogPremiumTransport, __('WConvert Pro is needed to download this design.', 'wconvert'));
        return $this->transport->premium($path, $limit);
    }

    /**
     * The exact design revision a setup pins, if the index lists it.
     *
     * @param array<string, mixed> $setup
     * @return array<string, mixed>|null
     */
    private function designOf(array $setup): ?array
    {
        foreach ($this->index()['designs'] as $candidate) {
            if ($candidate['id'] === $setup['design']['id'] && $candidate['revision'] === $setup['design']['revision']) return $candidate;
        }
        foreach ($this->index()['revisions'] as $candidate) {
            if ($candidate['id'] === $setup['design']['id'] && $candidate['revision'] === $setup['design']['revision']) return $candidate;
        }
        return null;
    }

    /**
     * @param array<string, mixed> $setup
     * @return array<string, mixed>
     */
    private function designFor(array $setup): array
    {
        return $this->designOf($setup) ?? throw new \RuntimeException(__('The design this setup uses is no longer listed. Refresh the library.', 'wconvert'));
    }

    /** @return array<string, mixed> */
    private function entry(string $id): array
    {
        foreach ($this->index()['designs'] as $entry) {
            if ($entry['id'] !== $id) continue;
            PackValidator::check(!$this->isWithdrawn($entry['id'], $entry['revision']), __('This design has been withdrawn.', 'wconvert'));
            return $entry;
        }
        throw new \RuntimeException(__('This design is no longer listed. Refresh the library.', 'wconvert'));
    }

    /**
     * @param array<string, mixed> $cache
     */
    private function read(array $cache, int $started): void
    {
        $source = $this->source();
        $this->base();
        $sameSource = ($cache['source'] ?? '') === $source;
        $answer = $this->transport->revalidate($source, $sameSource ? ($cache['etag'] ?? null) : null);
        $checked = gmdate('c', $this->now());
        if ($answer === null) {
            // 304: nothing moved. Confirm the files are still here, then stop.
            if ($sameSource && $this->indexFiles($cache) !== null) {
                $this->options->set(self::CACHE_OPTION, ['checked_at' => $checked] + $cache);
                return;
            }
            $answer = $this->transport->revalidate($source, null);
            PackValidator::check($answer !== null, __('The catalog could not be reached. Installed designs are still available. Retry when the connection returns.', 'wconvert'));
        }
        $pointer = CatalogIndex::pointer($answer['body']);
        $files = ['release' => $pointer['release'], 'pages' => [], 'popularity' => null, 'i18n' => null, 'truncated' => false];
        $known = $sameSource && ($cache['release'] ?? null) === $pointer['release'] ? $this->indexFiles($cache) : null;
        if ($known !== null) {
            $files = $known;
        } else {
            $release = CatalogIndex::release($this->indexObject('releases/', $pointer['release'], $started));
            $bytes = 0;
            foreach ($release['pages'] as $sha) {
                $page = $this->indexObject('index/', $sha, $started);
                // A library grown past this reader's budget costs the pages
                // beyond it, never the ones before: keep what fits and say so.
                if ($bytes + strlen($page) > CatalogIndex::MAX_INDEX_BYTES) { $files['truncated'] = true; break; }
                $bytes += strlen($page);
                CatalogIndex::page($page, $this->facets());
                $files['pages'][] = $sha;
            }
            if (isset($release['i18n'][$this->locale()])) {
                try { $this->indexObject('index/', $release['i18n'][$this->locale()], $started); $files['i18n'] = $release['i18n'][$this->locale()]; }
                catch (\RuntimeException $error) { /* English stays in the entries. */ }
            }
        }
        // Popularity is a nicety: it may change without a release and it may fail.
        $files['popularity'] = null;
        if ($pointer['popularity'] !== null) {
            try { $this->indexObject('index/', $pointer['popularity'], $started); $files['popularity'] = $pointer['popularity']; }
            catch (\RuntimeException $error) { /* Sorting falls back to recommended. */ }
        }
        $this->options->set(self::CACHE_OPTION, [
            'source' => $source, 'checked_at' => $checked, 'etag' => $answer['etag'], 'release' => $pointer['release'],
            'withdrawn' => $pointer['withdrawn'], 'latest_major' => $pointer['latest_major'], 'files' => $files,
        ]);
        $this->archive->prune(array_values(array_filter(array_merge([$files['release'], $files['popularity'], $files['i18n']], $files['pages']))));
    }

    /**
     * A content-addressed index object: from the local copy when it verifies,
     * otherwise fetched, verified and kept.
     */
    private function indexObject(string $folder, string $sha256, int $started): string
    {
        $local = $this->archive->object('index', $sha256);
        if ($local !== null) return $local;
        PackValidator::check($this->now() - $started <= self::BUDGET_SECONDS, __('The template library took too long to answer. Try again later. Installed designs are still available.', 'wconvert'));
        $json = $this->transport->get($this->base() . $folder . $sha256 . '.json');
        PackValidator::check(hash_equals($sha256, hash('sha256', $json)), __('The catalog changed while it was being read. Refresh again.', 'wconvert'));
        $this->archive->store('index', $sha256, $json);
        return $json;
    }

    /**
     * @param array<string, mixed> $cache
     * @return array<string, mixed>|null the cached file list, if every file is still here
     */
    private function indexFiles(array $cache): ?array
    {
        $files = $cache['files'] ?? null;
        if (!is_array($files) || !CatalogIndex::digest($files['release'] ?? null) || !is_array($files['pages'] ?? null)) return null;
        foreach (array_merge([$files['release']], $files['pages']) as $sha) {
            if (!is_string($sha) || $this->archive->object('index', $sha) === null) return null;
        }
        return $files;
    }

    /**
     * The verified local index, read once per request.
     *
     * @return array{designs: list<array<string, mixed>>, revisions: list<array<string, mixed>>, setups: list<array<string, mixed>>, collections: list<array<string, mixed>>, taxonomy: array<string, mixed>, popularity: array<string, int>, skipped: int}
     */
    private function index(): array
    {
        if ($this->index !== null) return $this->index;
        $empty = self::EMPTY_INDEX;
        $cache = $this->cache();
        $files = ($cache['source'] ?? '') === $this->source() ? $this->indexFiles($cache) : null;
        if ($files === null) return $this->index = $empty;
        try {
            $release = CatalogIndex::release((string) $this->archive->object('index', $files['release']));
            $index = $empty;
            $index['collections'] = $release['collections'];
            $index['taxonomy'] = $release['taxonomy'];
            $words = is_string($files['i18n'] ?? null) ? CatalogIndex::translations((string) $this->archive->object('index', $files['i18n'])) : [];
            $seen = [];
            foreach ($files['pages'] as $sha) {
                $page = CatalogIndex::page((string) $this->archive->object('index', $sha), $this->facets());
                $index['skipped'] += $page['skipped'];
                foreach ($page['designs'] as $entry) {
                    // One entry per design id: the highest revision listed wins.
                    // Older revisions stay addressable for the setups that pin them.
                    if (isset($seen[$entry['id']]) && $seen[$entry['id']]['revision'] >= $entry['revision']) { $index['revisions'][] = $entry; continue; }
                    if (isset($seen[$entry['id']])) $index['revisions'][] = $seen[$entry['id']];
                    if (isset($words[$entry['id']]['name'])) $entry['name'] = $words[$entry['id']]['name'];
                    $seen[$entry['id']] = $entry;
                }
                foreach ($page['setups'] as $entry) $index['setups'][] = $entry;
            }
            $index['designs'] = array_values($seen);
            if (is_string($files['popularity'] ?? null)) $index['popularity'] = CatalogIndex::popularity((string) $this->archive->object('index', $files['popularity']));
            return $this->index = $index;
        } catch (\RuntimeException $error) {
            return $this->index = $empty;
        }
    }

    /** @return array<string, int> */
    private function local(): array
    {
        $revisions = $this->localRevisions !== null ? ($this->localRevisions)() : [];
        foreach ($this->archive->revisions() as $id => $revision) $revisions[$id] = max($revisions[$id] ?? 0, $revision);
        return $revisions;
    }

    /** @return array<string, mixed> */
    private function cache(): array
    {
        $cache = $this->options->get(self::CACHE_OPTION, []);
        return is_array($cache) ? $cache : [];
    }

    /** The folder the pointer sits in; every other object is addressed from it. */
    private function base(): string
    {
        $source = $this->source();
        $parts = wp_parse_url($source);
        PackValidator::check(is_array($parts) && isset($parts['scheme'], $parts['host']) && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['query']) && !isset($parts['fragment'])
            && preg_match('#/v' . CatalogIndex::MAJOR . '/manifest\.json$#D', (string) ($parts['path'] ?? '')) === 1, __('The catalog address must end in /v3/manifest.json.', 'wconvert'));
        return substr($source, 0, -strlen('manifest.json'));
    }

    /** @return array<string, list<string>> */
    private function facets(): array
    {
        return $this->facetVocabulary instanceof \Closure ? ($this->facetVocabulary)() : $this->facetVocabulary;
    }

    private function locale(): string
    {
        return $this->locale instanceof \Closure ? ($this->locale)() : $this->locale;
    }

    private function now(): int
    {
        return $this->clock !== null ? ($this->clock)() : time();
    }

    private function source(): string
    {
        return self::sourceIn($this->options);
    }

    private static function sourceIn(OptionStore $options): string
    {
        $value = $options->get(self::SOURCE_OPTION, self::DEFAULT_SOURCE);
        return is_string($value) ? $value : '';
    }
    // phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
}

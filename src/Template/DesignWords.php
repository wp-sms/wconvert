<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * A design's and a setup's words, in the site's language (ADR 0183).
 *
 * ============================================================================
 * ONE LIST PER LANGUAGE: "ENGLISH" => "TRANSLATION".
 * ============================================================================
 * The words a design starts with live in JSON no extractor reads, and there are
 * thousands of them. Rather than teach the text domain about them, each language
 * has one generated list (`bin/template-words.mjs`), and this walks a design or a
 * setup and replaces each word the list has. So one English phrase has one
 * translation everywhere, which is the price of needing no loader, no route and
 * no new storage.
 *
 * ============================================================================
 * IT RUNS ON TOP OF GETTEXT, SO A LANGUAGE PACK STILL WINS.
 * ============================================================================
 * A Playbook's words and a design's names pass through `__()` before they reach
 * this. A word a WordPress.org pack already translated is no longer English, so
 * the list misses it and it stays as the pack has it.
 *
 * ============================================================================
 * THE SITE'S LANGUAGE DECIDES, NOT THE ADMINISTRATOR'S PROFILE.
 * ============================================================================
 * `get_locale()`, because these words end up in front of the site's visitors.
 *
 * ============================================================================
 * THE MANIFEST SAYS WHICH KEYS ARE WORDS.
 * ============================================================================
 * Never a value that merely looks like one: an option's `value`, a field's
 * `name`, an `href` or a coupon code all stay exactly as they are, because a rule,
 * a Lead or a shop reads them. A new `content` key in the manifest is a word
 * unless it is listed in {@see self::NOT_WORDS}, and `DesignWordsTest` fails on a
 * key nobody has decided about.
 *
 * @since 1.1.0
 */
final class DesignWords
{
    public const PATH = 'resources/templates/words';

    /** Content keys that are addresses or data, whatever their type. */
    public const NOT_WORDS = ['src', 'href', 'apply_href'];

    /** A wrong variant reads as the wrong language: Simplified for Traditional, Latin for Cyrillic. */
    private const NO_SAME_LANGUAGE = ['zh', 'pt', 'sr'];

    /** The sites' own words, and a shop's coupon code, which a translation would break. */
    private const AUTHORED_ROLES = ['code_value', 'wordmark'];

    /** The strictest limit either reader holds each to ({@see \WConvert\Template\Catalog\PackValidator}, {@see ChoiceOptions}), in bytes. */
    private const LIMIT_NAME = 120;
    private const LIMIT_NOTE = 500;
    private const LIMIT_HEADING = 200;
    private const LIMIT_LINK = 200;
    private const LIMIT_OPTION = 120;
    private const LIMIT_DECORATION = 80;
    private const LIMIT_WORDS = 2000;

    /** @var array<string, array<string, string>> Decoded lists, by file, for this request. */
    private static array $files = [];

    /** @var array<string, list<string>>|null */
    private ?array $keys = null;

    /**
     * @param array<string, string> $words English => translation, every pair already {@see self::acceptable()}.
     * @param array<string, mixed>|null $manifest The template manifest, read only once there is a word to apply.
     */
    public function __construct(private readonly array $words = [], private readonly ?array $manifest = null)
    {
    }

    /**
     * The list a plugin's ZIP carries for this site's language.
     *
     * A site in English reads no file at all: nothing is listed for it.
     */
    public static function bundled(string $pluginDir = WCONVERT_DIR, ?string $locale = null): self
    {
        return new self(self::listFor($pluginDir, $locale ?? self::siteLocale()));
    }

    /**
     * Every list this site has, for words that arrived from outside any ZIP: an
     * installed paid setup's words are in Pro's list, never in a public file.
     */
    public static function everyBundled(?string $locale = null): self
    {
        $locale ??= self::siteLocale();

        /**
         * Filters the words read over an installed design or setup.
         *
         * @param array<string, string> $words English => translation.
         * @param string $locale The site's language.
         */
        $words = apply_filters('wconvert_design_words', self::listFor(WCONVERT_DIR, $locale), $locale);

        return new self(self::readList($words));
    }

    /**
     * One plugin's list for a language, or nothing where it carries none.
     *
     * @return array<string, string>
     */
    public static function listFor(string $pluginDir, string $locale): array
    {
        return self::fileFor(rtrim($pluginDir, '/') . '/' . self::PATH, $locale);
    }

    public static function siteLocale(): string
    {
        return function_exists('get_locale') ? get_locale() : 'en_US';
    }

    /**
     * Which of the available lists serves a locale: the exact one, then without
     * its variant (`de_DE_formal` → `de_DE`), then the same language, except where
     * the languages' variants are different writing systems or vocabularies.
     *
     * @param list<string> $available
     */
    public static function pick(string $locale, array $available): ?string
    {
        if (in_array($locale, $available, true)) {
            return $locale;
        }

        $parts = explode('_', $locale);
        $stripped = implode('_', array_slice($parts, 0, 2));

        if (in_array($stripped, $available, true)) {
            return $stripped;
        }

        if (in_array($parts[0], self::NO_SAME_LANGUAGE, true)) {
            return null;
        }

        $same = array_filter($available, static fn (string $candidate): bool => explode('_', $candidate)[0] === $parts[0]);
        sort($same);

        return $same[0] ?? null;
    }

    /**
     * Whether a translation may stand in for its English: not empty, no markup,
     * and every `%s`, `%b` and `%i` kept, so a privacy link cannot silently go.
     * A word that only looks like a mark (`100%ig`) counts as one, as it would
     * on the page, so it is refused too.
     */
    public static function acceptable(string $english, string $translated): bool
    {
        if ($translated === '' || trim($translated) !== $translated || strlen($translated) > self::LIMIT_WORDS) {
            return false;
        }

        if (preg_match('/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/', $translated) === 1) {
            return false;
        }

        foreach (['%s', '%b', '%i'] as $mark) {
            if (substr_count($english, $mark) !== substr_count($translated, $mark)) {
                return false;
            }
        }

        return true;
    }

    /** Whether a string has words in it at all: `%b` and `20%` read the same in every language. */
    public static function isWord(string $text): bool
    {
        return preg_match('/\p{L}/u', str_replace(['%s', '%b', '%i'], '', $text)) === 1;
    }

    /**
     * Only the pairs that may stand in, so a bad one costs its own word.
     *
     * @return array<string, string>
     */
    public static function readList(mixed $decoded): array
    {
        $words = [];

        foreach (is_array($decoded) ? $decoded : [] as $english => $translated) {
            if (is_string($english) && is_string($translated) && self::acceptable($english, $translated)) {
                $words[$english] = $translated;
            }
        }

        return $words;
    }

    /** @return array<string, string> */
    private static function fileFor(string $directory, string $locale): array
    {
        $available = array_map(static fn (string $file): string => basename($file, '.json'), glob($directory . '/*.json') ?: []);
        $picked = self::pick($locale, $available);

        if ($picked === null) {
            return [];
        }

        $file = $directory . '/' . $picked . '.json';

        return self::$files[$file] ??= self::readList(JsonFile::read($file));
    }

    /**
     * A design with every word the list has replaced, one word at a time: a word
     * the list lacks stays English beside its translated neighbours.
     *
     * For what a ZIP ships, whose lists CI holds to every word.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public function template(array $entry): array
    {
        return $this->words === [] ? $entry : self::walkTemplate($entry, $this->keys(), $this->replaceEach(...));
    }

    /**
     * A setup's words, the same way.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public function playbook(array $entry): array
    {
        return $this->words === [] ? $entry : self::walkPlaybook($entry, $this->replaceEach(...));
    }

    /**
     * A design in the language only if every word has a translation; otherwise as
     * it is, whole. For what arrives from the catalogue: half a popup in German is
     * worse than an English one, and the release it came with may be older.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public function templateOrEnglish(array $entry): array
    {
        if ($this->words === []) {
            return $entry;
        }

        $complete = true;
        $translated = self::walkTemplate($entry, $this->keys(), $this->replaceAll($complete));

        return $complete ? $translated : $entry;
    }

    /**
     * A setup in the language only if every word has a translation.
     *
     * @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public function playbookOrEnglish(array $entry): array
    {
        if ($this->words === []) {
            return $entry;
        }

        $complete = true;
        $translated = self::walkPlaybook($entry, $this->replaceAll($complete));

        return $complete ? $translated : $entry;
    }

    /** A catalogue card's name, which stands alone. */
    public function name(string $english): string
    {
        return self::isWord($english) ? $this->replaceEach($english, self::LIMIT_NAME) : $english;
    }

    /**
     * This list with a newer one over it: a release's words outrank a ZIP's.
     *
     * @param array<string, string> $words
     */
    public function with(array $words): self
    {
        return new self($words + $this->words, $this->manifest);
    }

    private function replaceAll(bool &$complete): \Closure
    {
        return function (string $english, int $limit) use (&$complete): string {
            $translated = $this->replaceEach($english, $limit);
            $complete = $complete && ($translated !== $english || ($this->words[$english] ?? null) === $english);

            return $translated;
        };
    }

    private function replaceEach(string $english, int $limit): string
    {
        $translated = $this->words[$english] ?? null;

        return $translated !== null && strlen($translated) <= $limit ? $translated : $english;
    }

    /**
     * The words of a design, by what they are.
     *
     * @param array<string, mixed> $entry
     * @param array<string, mixed> $manifest
     * @return array<string, array{limit: int, kind: string}>
     */
    public static function wordsOfTemplate(array $entry, array $manifest): array
    {
        $found = [];
        self::walkTemplate($entry, self::wordKeys($manifest), static function (string $english, int $limit, string $kind) use (&$found): string {
            $found[$english] = ['limit' => min($limit, $found[$english]['limit'] ?? PHP_INT_MAX), 'kind' => $found[$english]['kind'] ?? $kind];
            return $english;
        });

        return $found;
    }

    /**
     * @param array<string, mixed> $entry
     * @return array<string, array{limit: int, kind: string}>
     */
    public static function wordsOfPlaybook(array $entry): array
    {
        $found = [];
        self::walkPlaybook($entry, static function (string $english, int $limit, string $kind) use (&$found): string {
            $found[$english] = ['limit' => min($limit, $found[$english]['limit'] ?? PHP_INT_MAX), 'kind' => $found[$english]['kind'] ?? $kind];
            return $english;
        });

        return $found;
    }

    /**
     * Each node type's keys that hold words: the manifest's `content`, less what
     * is an address, and less a `code` node's `text`, which is the coupon.
     *
     * @param array<string, mixed> $manifest
     * @return array<string, list<string>>
     */
    public static function wordKeys(array $manifest): array
    {
        $keys = [];

        foreach ($manifest['nodes'] ?? [] as $type => $definition) {
            $content = is_array($definition['content'] ?? null) ? $definition['content'] : [];
            $keys[$type] = array_values(array_diff($content, self::NOT_WORDS, $type === 'code' ? ['text'] : []));
        }

        return $keys;
    }

    /** @return array<string, list<string>> */
    private function keys(): array
    {
        return $this->keys ??= self::wordKeys($this->manifest ?? TemplateManifest::load());
    }

    /**
     * @param array<string, mixed> $entry
     * @param array<string, list<string>> $keys
     * @param callable(string, int, string): string $visit
     * @return array<string, mixed>
     */
    private static function walkTemplate(array $entry, array $keys, callable $visit): array
    {
        self::word($entry, 'name', self::LIMIT_NAME, 'design name', $visit);

        foreach (is_array($entry['tree']['steps'] ?? null) ? $entry['tree']['steps'] : [] as $at => $step) {
            if (!is_array($step)) {
                continue;
            }

            self::word($step, 'name', self::LIMIT_NAME, 'screen name', $visit);
            self::word($step, 'details_note', self::LIMIT_NOTE, 'note on a details screen', $visit);

            foreach (is_array($step['results'] ?? null) ? $step['results'] : [] as $index => $result) {
                if (is_array($result)) {
                    self::word($result, 'heading', self::LIMIT_HEADING, 'quiz result heading', $visit);
                    self::word($result, 'body', self::LIMIT_NOTE, 'quiz result text', $visit);
                    self::word($result, 'link_label', self::LIMIT_NAME, 'quiz result link', $visit);
                    $step['results'][$index] = $result;
                }
            }

            if (is_array($step['content'] ?? null)) {
                $step['content'] = self::walkNode($step['content'], $keys, $visit);
            }

            $entry['tree']['steps'][$at] = $step;
        }

        return $entry;
    }

    /**
     * @param array<string, mixed> $node
     * @param array<string, list<string>> $keys
     * @param callable(string, int, string): string $visit
     * @return array<string, mixed>
     */
    private static function walkNode(array $node, array $keys, callable $visit): array
    {
        $type = is_string($node['type'] ?? null) ? $node['type'] : '';

        foreach (TemplateTree::CHILD_KEYS as $childKey) {
            foreach (is_array($node[$childKey] ?? null) ? $node[$childKey] : [] as $at => $child) {
                if (is_array($child)) {
                    $node[$childKey][$at] = self::walkNode($child, $keys, $visit);
                }
            }
        }

        if (is_array($node['decorations'] ?? null)) {
            self::word($node['decorations'], 'label', self::LIMIT_DECORATION, 'description of a decoration', $visit);
        }

        foreach ($keys[$type] ?? [] as $key) {
            if ($key === 'options') {
                if (array_key_exists('options', $node)) {
                    $node['options'] = self::walkOptions($node['options'], $visit);
                }
            } elseif ($key === 'link') {
                if (is_array($node['link'] ?? null)) {
                    self::word($node['link'], 'label', self::LIMIT_LINK, 'link', $visit);
                }
            } elseif (!in_array($node['role'] ?? null, self::AUTHORED_ROLES, true)) {
                self::word($node, $key, self::LIMIT_WORDS, $type . ' ' . $key, $visit);
            }
        }

        return $node;
    }

    /**
     * @param callable(string, int, string): string $visit
     */
    private static function walkOptions(mixed $options, callable $visit): mixed
    {
        if (!is_array($options)) {
            return $options;
        }

        foreach ($options as $at => $option) {
            if (is_array($option)) {
                self::word($option, 'label', self::LIMIT_OPTION, 'answer choice', $visit);
                $options[$at] = $option;
            }
        }

        return $options;
    }

    /**
     * A setup's name and the words it fills a design with. Not its `notes`: those
     * are written to the merchant, and the admin's words are the text domain's.
     *
     * @param array<string, mixed> $entry
     * @param callable(string, int, string): string $visit
     * @return array<string, mixed>
     */
    private static function walkPlaybook(array $entry, callable $visit): array
    {
        self::word($entry, 'name', self::LIMIT_NAME, 'setup name', $visit);

        if (is_array($entry['copy'] ?? null)) {
            $entry['copy'] = self::walkCopy($entry['copy'], $visit);
        }

        return $entry;
    }

    /**
     * Whatever shape a role's words take: a string, a list of them, a sentence
     * with a link, an options list, or a whole `screens` map of the same.
     *
     * @param array<array-key, mixed> $copy
     * @param callable(string, int, string): string $visit
     * @return array<array-key, mixed>
     */
    private static function walkCopy(array $copy, callable $visit, string $role = ''): array
    {
        foreach ($copy as $key => $value) {
            if (is_string($key) && (in_array($key, self::NOT_WORDS, true) || $key === 'value' || in_array($key, self::AUTHORED_ROLES, true))) {
                continue;
            }

            if ($key === 'options') {
                $copy[$key] = self::walkOptions($value, $visit);
            } elseif ($key === 'link' && is_array($value)) {
                self::word($value, 'label', self::LIMIT_LINK, 'link', $visit);
                $copy[$key] = $value;
            } elseif (is_array($value)) {
                $copy[$key] = self::walkCopy($value, $visit, is_string($key) ? $key : $role);
            } elseif (is_string($value)) {
                $copy[$key] = self::visited($value, self::LIMIT_WORDS, is_string($key) && $role === '' ? $key : $role, $visit);
            }
        }

        return $copy;
    }

    /**
     * @param array<string, mixed> $holder
     * @param callable(string, int, string): string $visit
     */
    private static function word(array &$holder, string $key, int $limit, string $kind, callable $visit): void
    {
        if (is_string($holder[$key] ?? null)) {
            $holder[$key] = self::visited($holder[$key], $limit, $kind, $visit);
        }
    }

    /**
     * @param callable(string, int, string): string $visit
     */
    private static function visited(string $english, int $limit, string $kind, callable $visit): string
    {
        return self::isWord($english) ? $visit($english, $limit, $kind) : $english;
    }
}

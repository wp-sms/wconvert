<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The shipped Templates — the gallery's contents, as data.
 *
 * A Template is the DESIGN of an Optin, with no words in it: it declares which
 * slots exist, how they are arranged and how they are styled, and the copy
 * comes from the Playbook that prefilled the Optin. Whatever placeholder text
 * an entry carries exists so the gallery has something to show, and is never
 * copied into an Optin (CONTEXT.md, Template).
 *
 * **An Optin takes a COPY.** This registry is not consulted at render time and
 * never appears in the payload: `template_id` is provenance, exactly as
 * `playbook_id` is, so improving an entry never restyles an Optin already
 * running on it and deleting one leaves every Optin it started untouched
 * (ADR 0010).
 *
 * Entries are JSON rather than PHP arrays, which is the opposite of the choice
 * ADR 0013 makes for Playbooks — and for the reason that decision gives: a
 * Playbook is nothing but words, so `wp i18n make-pot` not seeing a JSON
 * string ships an English-only library. A Template is structure, and its only
 * words are placeholders no visitor ever reads.
 *
 * @since 0.1.0
 */
final class TemplateLibrary
{
    public const PATH = 'resources/templates/library';

    /**
     * @param array<string, array<string, mixed>> $templates
     */
    private function __construct(
        private readonly TemplateVocabulary $vocabulary,
        private readonly array $templates,
    ) {
    }

    public static function fromDirectory(TemplateVocabulary $vocabulary, string $pluginDir = WCONVERT_DIR): self
    {
        $files = glob(rtrim($pluginDir, '/') . '/' . self::PATH . '/*.json');
        $templates = [];

        foreach ($files === false ? [] : $files as $file) {
            $entry = self::read($file, $vocabulary);

            if ($entry !== null) {
                $templates[(string) $entry['id']] = $entry;
            }
        }

        ksort($templates);

        return new self($vocabulary, $templates);
    }

    /**
     * Every entry, keyed by id.
     *
     * @return array<string, array<string, mixed>>
     */
    public function all(): array
    {
        return $this->templates;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $id): ?array
    {
        return $this->templates[$id] ?? null;
    }

    /**
     * Take the copy.
     *
     * **The snapshot is of the DESIGN, never of the words.** A Template
     * declares which slots exist, how they are arranged and how they are
     * styled; the copy comes from the Playbook that prefilled the Optin, or
     * from the user. Whatever placeholder text an entry carries is for the
     * gallery and "is never copied into an Optin" (CONTEXT.md, Template) — so
     * what lands here is the tree with every word taken out of it and the
     * Slot Roles left in, which is the seam a Playbook binds to.
     *
     * **It happens when, and only when, the design changes.** An Optin that
     * already holds a copy of the Template it names keeps it untouched
     * whatever the entry says now, so improving a Template never restyles an
     * Optin already running on it and `template_id` stays what CONTEXT.md
     * calls it: provenance. Repicking is the other case and is not the same
     * one — a merchant who chooses a different Template gets a fresh copy,
     * because otherwise the id would say one design and the payload would
     * render another (ADR 0010).
     *
     * The renderer and the vocabulary are the other side of the arrangement.
     * They stay a LIVE reference, so a release that fixes accessibility or RTL
     * reaches every existing Optin, while a release that restyles a Template
     * reaches none.
     *
     * @param array<string, mixed> $config
     * @param string|null $pickedBefore The `template_id` this Optin was saved with, if any.
     * @return array<string, mixed>
     */
    public function snapshotInto(array $config, ?string $pickedBefore = null): array
    {
        $id = $config['template_id'] ?? null;

        if (!is_string($id)) {
            return $config;
        }

        if (isset($config['template']) && $id === $pickedBefore) {
            return $config;
        }

        $entry = $this->find($id);

        // A `template_id` naming nothing this install ships is left alone
        // rather than blanked: the id is provenance, and an Optin that arrived
        // from an entry we no longer carry is not a broken Optin.
        if ($entry === null) {
            return $config;
        }

        $config['template'] = [
            'tree' => $this->vocabulary->withoutCopy($entry['tree']),
            'tokens' => $entry['tokens'],
        ];

        return $config;
    }

    /**
     * One entry, validated against the vocabulary like anything else.
     *
     * A shipped Template gets no exemption, which is what makes the vocabulary
     * self-testing: an entry that normalises to something different from what
     * it says is an entry the settings panel could not have produced, and
     * `tests/unit/Template/TemplateLibraryTest.php` fails on it (ADR 0010).
     *
     * @return array<string, mixed>|null
     */
    private static function read(string $file, TemplateVocabulary $vocabulary): ?array
    {
        $raw = is_readable($file) ? file_get_contents($file) : false;
        $decoded = $raw === false ? null : json_decode($raw, true);

        if (!is_array($decoded) || !is_string($decoded['id'] ?? null) || $decoded['id'] === '') {
            return null;
        }

        $normalized = $vocabulary->normalize($decoded);

        return [
            'id' => $decoded['id'],
            'name' => is_string($decoded['name'] ?? null) ? $decoded['name'] : $decoded['id'],
            // One Template serves exactly one Display Type (CONTEXT.md,
            // Template), so this is a property of the entry rather than
            // something the merchant picks afterwards.
            'display_type' => is_string($decoded['display_type'] ?? null) ? $decoded['display_type'] : 'popup',
            'tree' => $normalized['tree'],
            'tokens' => $normalized['tokens'],
        ];
    }
}

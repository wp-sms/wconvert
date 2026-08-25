<?php

namespace WConvert\Template;

use WConvert\Support\Rejection;
use WConvert\Support\RejectionReason;

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
     * @param list<Rejection> $rejections
     */
    private function __construct(
        private readonly TemplateVocabulary $vocabulary,
        private readonly array $templates,
        private readonly array $rejections = [],
    ) {
    }

    public static function fromDirectory(TemplateVocabulary $vocabulary, string $pluginDir = WCONVERT_DIR): self
    {
        $files = glob(rtrim($pluginDir, '/') . '/' . self::PATH . '/*.json');
        $templates = [];
        $rejections = [];

        foreach ($files === false ? [] : $files as $file) {
            $entry = self::read($file, $vocabulary);

            if ($entry === null) {
                continue;
            }

            $reason = self::refuse($entry['tree']);

            if ($reason !== null) {
                $rejections[] = new Rejection((string) $entry['id'], $reason);
                continue;
            }

            $templates[(string) $entry['id']] = $entry;
        }

        ksort($templates);
        usort($rejections, static fn (Rejection $a, Rejection $b): int => strcmp($a->id, $b->id));

        foreach ($rejections as $rejection) {
            $rejection->warn(__METHOD__);
        }

        return new self($vocabulary, $templates, $rejections);
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
     * Every entry this install refused, and why.
     *
     * Recorded rather than thrown, and rather than dropped in silence. One
     * malformed entry must not take the gallery down; an entry that simply
     * vanished from it looks exactly like a gallery that failed to load
     * ({@see Rejection}).
     *
     * @return list<Rejection>
     */
    public function rejections(): array
    {
        return $this->rejections;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function find(string $id): ?array
    {
        return $this->templates[$id] ?? null;
    }

    /**
     * Why this tree may not be registered, or null.
     *
     * **One converting act, exactly**, and a step count that follows from it.
     * A Template offering both a form and a click-through CTA is rejected here
     * rather than disambiguated at runtime, because an Optin with two
     * candidate Conversions has no honest number to report; one offering
     * neither reports zero forever, which is the same rule read the other way
     * (ADR 0020, CONTEXT.md Conversion).
     *
     * The step count is the act's, not the entry's: a submit-metered design
     * has two steps because the post-submit success state is a terminal step,
     * and a click-metered one has one because the click navigates the visitor
     * away and an interstitial is worse than the navigation it delays
     * (ADR 0010, corrected by ADR 0025).
     *
     * @param array{steps: list<array<string, mixed>>} $tree
     */
    private static function refuse(array $tree): ?RejectionReason
    {
        $acts = ConvertingAct::offeredIn($tree);

        if (count($acts) > 1) {
            return RejectionReason::TwoConvertingActs;
        }

        if ($acts === []) {
            return RejectionReason::NoConvertingAct;
        }

        return count($tree['steps']) === $acts[0]->steps() ? null : RejectionReason::WrongStepCount;
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
     * **`$pickedBefore` is the id the copy in `$config` was TAKEN FOR**, which
     * on an update is the stored row's and on a create is whatever the
     * incoming config asserts — a create has no stored row, so the config that
     * arrived is the prior state. That is what lets a prefilled Optin keep the
     * [[Playbook]] words already written into its copy: re-snapshotting on the
     * way in would strip them, because a snapshot is of the design and a
     * Template carries no copy.
     *
     * @param array<string, mixed> $config
     * @param string|null $pickedBefore The `template_id` the copy in `$config` was taken for.
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

<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The designs in this ZIP: one directory of JSON files.
 *
 * The glob that used to be the first ten lines of
 * {@see TemplateLibrary::fromDirectory()}, moved behind {@see TemplateSource}
 * so it is one source among several rather than the only one there can be.
 *
 * **Always present, so a fresh or offline install is never empty.** Whatever a
 * fetched index does or fails to do, this is what the picker has — which is
 * what makes the remote source a separable ticket rather than a dependency
 * (ADR 0043).
 *
 * Entries are JSON rather than PHP arrays, which is the opposite of ADR 0013's
 * choice for [[Playbook]]s and for the reason that decision gives: a Playbook
 * is nothing but words, so `wp i18n make-pot` not seeing a JSON string ships
 * an English-only library. A Template is structure, and its only words are
 * placeholders no visitor ever reads.
 *
 * @since 0.1.0
 */
final class BundledTemplates implements TemplateSource
{
    public const PATH = 'resources/templates/library';

    public function __construct(
        private readonly string $pluginDir = WCONVERT_DIR,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function entries(): array
    {
        $files = glob(rtrim($this->pluginDir, '/') . '/' . self::PATH . '/*.json');
        $entries = [];

        foreach ($files === false ? [] : $files as $file) {
            $decoded = JsonFile::read($file);

            if ($decoded !== null) {
                $entries[] = $decoded;
            }
        }

        return $entries;
    }
}

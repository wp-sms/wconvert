<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * A bundled design's name and its screens' names, in the site's language.
 *
 * They are what the gallery, the builder's screen list and the flow map show a
 * merchant, and they are authored in JSON, which no extractor reads. So
 * `bin/template-labels.mjs` writes them into a `labels.php` of literal
 * `_x()` calls beside each plugin's designs, and this applies the file as the
 * designs are read: free's from {@see BundledTemplates}, Pro's from Pro's own
 * source.
 *
 * Only bundled designs are named here. A downloaded or imported copy carries
 * the words it arrived with, which no catalogue of this plugin can hold.
 *
 * @since 0.1.0
 */
final class TemplateNames
{
    /**
     * @param list<array<string, mixed>> $entries As a template source decoded them.
     * @return list<array<string, mixed>>
     */
    public static function apply(array $entries, string $labelsFile): array
    {
        if (!is_file($labelsFile)) {
            return $entries;
        }

        $labels = require $labelsFile;

        if (!is_array($labels)) {
            return $entries;
        }

        foreach ($entries as &$entry) {
            $label = $labels[$entry['id'] ?? ''] ?? null;

            if (!is_array($label)) {
                continue;
            }

            if (is_string($label['name'] ?? null)) {
                $entry['name'] = $label['name'];
            }

            foreach ($entry['tree']['steps'] ?? [] as $at => $step) {
                $name = $label['steps'][$step['id'] ?? ''] ?? null;

                if (is_string($name)) {
                    $entry['tree']['steps'][$at]['name'] = $name;
                }
            }
        }
        unset($entry);

        return $entries;
    }
}

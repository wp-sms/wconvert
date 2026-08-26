<?php

namespace WConvert\Support;

defined('ABSPATH') || exit;

/**
 * Reading a manifest off disk, fail-closed.
 *
 * Two manifests are read this way — the rule vocabulary and the template
 * vocabulary — and the reading is identical in both because the POSTURE is
 * the property, not the file: an unreadable or unparseable manifest throws
 * rather than degrading to an empty vocabulary.
 *
 * That direction is deliberate and is the whole reason this is shared rather
 * than written twice. An empty rule vocabulary silently accepts nothing and
 * shows nothing; an empty template vocabulary validates every template down to
 * nothing and shows a blank popup. Both are failures that look like an install
 * with no Optins configured, which is the hardest kind to notice.
 *
 * @since 0.1.0
 */
final class JsonManifest
{
    /**
     * @param string $subject What to call the file when it cannot be read.
     * @return array<string, mixed>
     */
    public static function load(string $path, string $subject): array
    {
        $raw = is_readable($path) ? file_get_contents($path) : false;

        if ($raw === false) {
            throw new \RuntimeException(
                sprintf('WConvert %s is unreadable at %s.', esc_html($subject), esc_html($path))
            );
        }

        $decoded = json_decode($raw, true);

        if (!is_array($decoded)) {
            throw new \RuntimeException(
                sprintf('WConvert %s at %s is not valid JSON.', esc_html($subject), esc_html($path))
            );
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }
}

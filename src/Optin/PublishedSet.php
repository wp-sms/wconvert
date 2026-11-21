<?php

namespace WConvert\Optin;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * The published set: one non-autoloaded option holding the projection of every
 * published, non-deleted Optin.
 *
 * **Rebuilt on write, never on read.** An option rather than a transient
 * because a transient can be evicted, and eviction lands a cold DB query on an
 * uncached page load — this is derived state that must never miss, not a cache
 * (ADR 0003).
 *
 * `autoload=false` because it is payload-sized and has no business in
 * `alloptions` on every admin request. {@see \WConvert\Storage\WpOptionStore}
 * passes that on every write.
 *
 * @since 0.1.0
 */
final class PublishedSet
{
    public const OPTION = 'wconvert_published_set';

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function all(): array
    {
        $set = $this->options->get(self::OPTION, []);

        return is_array($set) ? array_values($set) : [];
    }

    /**
     * **False when the table would not take it** (#424), and then nothing is
     * announced: `wconvert_published_set_changed` purges the page cache, and a
     * purge after a refused write only refills it with the old set.
     *
     * The screen lists go first and a refused one stops the set being written,
     * so a live entry never lacks the screen names its reports are read with.
     *
     * @param list<array<string, mixed>> $set
     */
    public function replaceWith(array $set): bool
    {
        foreach ($set as $entry) {
            $revision = $entry['payload']['capture_contract'] ?? null;
            if (!is_string($revision)) { continue; }
            $definition = [];
            foreach ($entry['payload']['template']['tree']['steps'] ?? [] as $index => $screen) {
                $definition[$screen['id']] = ['name' => $screen['name'], 'order' => $index];
            }
            if (!$this->options->set(self::flowOption((string) $entry['id'], $revision), $definition)) {
                return false;
            }
        }
        if (!$this->options->set(self::OPTION, $set)) {
            return false;
        }
        do_action('wconvert_published_set_changed');

        return true;
    }

    /**
     * The screens one published revision had, by screen id: `name` and
     * `order`. Reports read a revision's screens here, because the Optin row
     * only keeps the latest one.
     *
     * @return array<string, mixed>
     */
    public function flow(string $optinId, string $revision): array
    {
        $definition = $this->options->get(self::flowOption($optinId, $revision), []);

        return is_array($definition) ? $definition : [];
    }

    private static function flowOption(string $optinId, string $revision): string
    {
        return 'wconvert_flow_' . $optinId . '_' . $revision;
    }
}

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
     * @param list<array<string, mixed>> $set
     */
    public function replaceWith(array $set): void
    {
        $this->options->set(self::OPTION, $set);
    }
}

<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * One Optin: the unit of work in WConvert — a designed thing, shown to a
 * chosen audience, under a set of display rules, serving one Goal.
 *
 * It carries the `wsms_flows` shape: `config` is the working draft the
 * merchant edits, `published_config` is what the site is actually serving, and
 * one `publish()` promotes the first onto the second. The two are separate
 * columns so that editing an Optin is not publishing as you type.
 *
 * @since 0.1.0
 */
final class Optin
{
    /**
     * @param array<string, mixed>      $config
     * @param array<string, mixed>|null $publishedConfig
     */
    public function __construct(
        public readonly string $id,
        public readonly string $name,
        public readonly string $goal,
        public readonly array $config = [],
        public readonly ?array $publishedConfig = null,
        public readonly ?string $publishedAt = null,
        public readonly ?string $deletedAt = null,
        /**
         * The [[Optin]] this one is a [[Variant]] of, or null where it is a
         * campaign in its own right.
         *
         * A column rather than a key in `config`, because the Optins list
         * FILTERS on it and that list reads neither LONGTEXT column by design
         * (ADR 0001, ADR 0045). It is carried on the object for the same
         * reason `goal` is: a caller that wants it should not have to reach
         * into a row array to find out whether this Optin is an arm of a
         * test.
         */
        public readonly ?string $parentId = null,
        /** {@see self::snapshotsDiffer()} on the stored JSON, supplied by reads to match the list. */
        private readonly ?bool $snapshotsDiffer = null,
        /** Computed from the existing Variant rows, not a stored flag. */
        private readonly bool $hasVariants = false,
    ) {
    }

    /**
     * @param array<string, string|null> $row
     */
    public static function fromRow(array $row, bool $hasVariants = false): self
    {
        return new self(
            (string) ($row['id'] ?? ''),
            (string) ($row['name'] ?? ''),
            (string) ($row['goal'] ?? ''),
            self::decode($row['config'] ?? null) ?? [],
            self::decode($row['published_config'] ?? null),
            $row['published_at'] ?? null,
            $row['deleted_at'] ?? null,
            // Empty reads as absent. `parent_id` is `CHAR(26) NULL` and a
            // driver that hands back `''` for it must not produce an Optin
            // claiming to be an arm of a test with no id.
            ($row['parent_id'] ?? '') === '' ? null : (string) $row['parent_id'],
            self::snapshotsDiffer($row['config'] ?? null, $row['published_config'] ?? null),
            $hasVariants,
        );
    }

    public function isPublished(): bool
    {
        return $this->publishedAt !== null && $this->deletedAt === null;
    }

    public function isDeleted(): bool
    {
        return $this->deletedAt !== null;
    }

    /** The last published snapshot survives unpublishing. A Variant keeps its family's Goal. */
    public function canChangeGoal(): bool
    {
        return $this->publishedConfig === null && $this->publishedAt === null && $this->parentId === null && !$this->hasVariants;
    }

    /** A draft may be incomplete; promotion requires at least one design screen. */
    public function hasDesign(): bool
    {
        $steps = $this->config['template']['tree']['steps'] ?? null;

        return is_array($steps) && $steps !== [];
    }

    /**
     * Saved changes awaiting promotion, never an additional stored state.
     * The draft is compared as it would publish ({@see self::snapshotsDiffer()}).
     */
    public function hasUnpublishedChanges(): bool
    {
        return $this->isPublished() && ($this->snapshotsDiffer
            ?? (PhoneCountry::resolved($this->config) ?? $this->config) !== $this->publishedConfig);
    }

    /**
     * **Whether publishing the stored draft would change what is live (#369).**
     *
     * Publishing resolves a phone field's `site` country into the snapshot
     * (ADR 0105), so a raw comparison called every published phone campaign
     * changed the moment it went live. The draft is resolved the way
     * {@see OptinRepository::publish()} resolves it, with today's site
     * country, and encoded the way it writes it. A site country changed since
     * publishing therefore does show here, which is right: it applies only on
     * republish.
     *
     * Equal stored text is the cheap answer and the common one. The rest is
     * compared as stored, case and key order included, like the list's BINARY
     * comparison. A draft that cannot resolve (a phone field with no country)
     * would not publish, so it differs.
     */
    public static function snapshotsDiffer(?string $config, ?string $published): bool
    {
        if ($config === $published) {
            return false;
        }

        $draft = self::decode($config);
        $resolved = $draft === null || $published === null ? null : PhoneCountry::resolved($draft);

        return $resolved === null || (string) wp_json_encode($resolved) !== $published;
    }

    /**
     * The Optin as the admin sees it. Never the raw row: `config` and
     * `published_config` are LONGTEXT JSON and go out decoded or not at all.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'goal' => $this->goal,
            'can_change_goal' => $this->canChangeGoal(),
            'config' => $this->config,
            'published_config' => $this->publishedConfig,
            'published_at' => $this->publishedAt,
            'has_unpublished_changes' => $this->hasUnpublishedChanges(),
            'deleted_at' => $this->deletedAt,
            'parent_id' => $this->parentId,
            'status' => $this->isDeleted() ? 'deleted' : ($this->isPublished() ? 'published' : 'draft'),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function decode(?string $json): ?array
    {
        if ($json === null || $json === '') {
            return null;
        }

        $decoded = json_decode($json, true);

        return is_array($decoded) ? $decoded : null;
    }
}

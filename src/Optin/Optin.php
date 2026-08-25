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
    ) {
    }

    /**
     * @param array<string, string|null> $row
     */
    public static function fromRow(array $row): self
    {
        return new self(
            (string) ($row['id'] ?? ''),
            (string) ($row['name'] ?? ''),
            (string) ($row['goal'] ?? ''),
            self::decode($row['config'] ?? null) ?? [],
            self::decode($row['published_config'] ?? null),
            $row['published_at'] ?? null,
            $row['deleted_at'] ?? null,
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
            'config' => $this->config,
            'published_config' => $this->publishedConfig,
            'published_at' => $this->publishedAt,
            'deleted_at' => $this->deletedAt,
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

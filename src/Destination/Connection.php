<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * Stored credentials for one remote account — a Mailchimp API key, a Brevo
 * key.
 *
 * **One Connection backs one or more [[Destination]]s**, so two Mailchimp
 * audiences are two Destinations over one Connection and the merchant pastes
 * the key once. Not every Destination has one: a webhook's URL is its whole
 * configuration, and the WSMS push authenticates against nothing
 * (CONTEXT.md, Connection).
 *
 * **The credentials sit in the clear**, and that is the honest answer rather
 * than the comfortable one. WordPress has no key management: a key encrypted
 * with a key in the same database is theatre, and a key in `wp-config.php`
 * breaks on migration and loses the merchant their integrations. The real
 * protection is that credentials are **never returned through REST** — the
 * controller accepts writes and hands back {@see self::masked()} — and are
 * excluded from exports. Read access to the database already means game over
 * (#4).
 *
 * Not to be confused with {@see \WConvert\Database\Connection}, which is the
 * narrow slice of `$wpdb` this plugin may use. Same word, and the glossary owns
 * this one.
 *
 * @since 0.1.0
 */
final class Connection
{
    /** What a merchant sees instead of a stored secret. */
    private const MASK = '••••••••';

    /**
     * @param string $type The {@see DestinationType} id these credentials belong to.
     * @param array<string, mixed> $credentials
     */
    public function __construct(
        public readonly string $id,
        public readonly string $type,
        public readonly string $label,
        public readonly array $credentials = [],
    ) {
    }

    /**
     * @param array<string, mixed> $stored
     */
    public static function fromArray(string $id, array $stored): self
    {
        return new self(
            $id,
            (string) ($stored['type'] ?? ''),
            (string) ($stored['label'] ?? ''),
            is_array($stored['credentials'] ?? null) ? $stored['credentials'] : [],
        );
    }

    /**
     * @return array{type: string, label: string, credentials: array<string, mixed>}
     */
    public function toArray(): array
    {
        return ['type' => $this->type, 'label' => $this->label, 'credentials' => $this->credentials];
    }

    /**
     * The Connection as REST may return it: every credential replaced by a
     * mask, and the KEYS kept so the admin can render the fields it has.
     *
     * A field is reported as filled or empty and never as its value. That is
     * the whole of the protection described in the class docblock, and it is
     * here rather than in the controller so a second caller cannot forget it.
     *
     * @return array{id: string, type: string, label: string, credentials: array<string, string>}
     */
    public function masked(): array
    {
        $masked = [];

        foreach ($this->credentials as $field => $value) {
            $masked[(string) $field] = ($value === null || $value === '') ? '' : self::MASK;
        }

        return ['id' => $this->id, 'type' => $this->type, 'label' => $this->label, 'credentials' => $masked];
    }
}

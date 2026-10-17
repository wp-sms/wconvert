<?php

namespace WConvert\Lead;

use DateTimeImmutable;
use InvalidArgumentException;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/** Read-only filters shared by history, its count, group drilldown and CSV. */
final class LeadQuery
{
    // phpcs:disable WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
    public function __construct(
        public readonly ?string $optinId = null,
        public readonly ?string $identifier = null,
        public readonly ?string $leadId = null,
        public readonly ?string $from = null,
        public readonly ?string $to = null,
        public readonly string $snapshot = '',
        public readonly ?string $before = null,
        public readonly ?string $groupIdentifier = null,
        public readonly ?string $search = null,
        public readonly ?string $purpose = null,
        public readonly string $order = 'newest',
    ) {
    }

    /** @param array<string, mixed> $input */
    public static function fromInput(array $input): self
    {
        $value = static function (string $key) use ($input): ?string {
            if (!isset($input[$key])) return null;
            if (!is_string($input[$key])) {
                throw new InvalidArgumentException(__('A history filter has an invalid value.', 'wconvert'));
            }
            $value = trim($input[$key]);
            return $value === '' ? null : $value;
        };
        $optin = $value('optin_id');
        $lead = $value('lead_id');
        $snapshot = $value('snapshot');
        foreach ([$optin, $lead, $snapshot] as $id) {
            if ($id !== null && !Ulid::isOne($id)) {
                throw new InvalidArgumentException(__('A history filter contains an invalid ID.', 'wconvert'));
            }
        }
        $before = null;
        if (($cursor = $value('cursor')) !== null) {
            $parts = explode(':', (string) base64_decode($cursor, true));
            if (count($parts) !== 2 || !Ulid::isOne($parts[0]) || !Ulid::isOne($parts[1])
                || ($snapshot !== null && $snapshot !== $parts[0])) {
                throw new InvalidArgumentException(__('This history page could not be read. Refresh submissions and try again.', 'wconvert'));
            }
            [$snapshot, $before] = $parts;
        }
        $from = $value('from');
        $to = $value('to');
        foreach ([$from, $to] as $date) {
            if ($date !== null) self::date($date);
        }
        if ($from !== null && $to !== null && $from > $to) {
            throw new InvalidArgumentException(__('The end date must be on or after the start date.', 'wconvert'));
        }
        $canonical = static function (?string $raw): ?string {
            if ($raw === null) return null;
            $identifier = Identifier::email($raw) ?? Identifier::phone($raw);
            if ($identifier === null) {
                throw new InvalidArgumentException(__('Enter a complete email address or a phone number with its country code.', 'wconvert'));
            }
            return $identifier;
        };

        $search = $value('search');
        $purpose = $value('purpose');
        $order = $value('order') ?? 'newest';
        if (!in_array($order, ['newest', 'oldest'], true)) {
            throw new InvalidArgumentException(__('Choose a valid submission order.', 'wconvert'));
        }
        if ($purpose !== null && !in_array($purpose, ['subscribers', 'enquiries'], true)) {
            throw new InvalidArgumentException(__('Choose a valid submission view.', 'wconvert'));
        }
        if ($search !== null && (strlen($search) > 800 || preg_match('/^.{1,200}$/us', $search) !== 1)) {
            throw new InvalidArgumentException(__('Search must be 200 characters or fewer.', 'wconvert'));
        }
        return new self($optin, $canonical($value('identifier')), $lead, $from, $to,
            $snapshot ?? self::snapshotNow(), $before, $canonical($value('group_identifier')), $search, $purpose, $order);
    }

    /** Exclude the current millisecond too: later captures cannot enter this paging window. */
    public static function snapshotNow(): string
    {
        return Ulid::floorAt((int) floor(microtime(true) * 1000));
    }

    public function nextCursor(string $lastId): string
    {
        return base64_encode($this->snapshot . ':' . $lastId);
    }

    /**
     * Whether any filter narrows the log below "everything before the snapshot".
     * Read off the same predicates the query is built from, so a filter added
     * there narrows here without being listed twice. The snapshot, the cursor
     * and the order do not narrow: they page the same set.
     */
    public function narrowed(): bool
    {
        return $this->filters([])['sql'] !== '1 = 1';
    }

    /**
     * The search predicate, spelled for the database it runs on.
     *
     * ========================================================================
     * THE ONE PLACE A STATEMENT IS SPELLED PER ENGINE.
     * ========================================================================
     * A captured answer must be compared as the text the visitor typed. MySQL
     * and MariaDB hand `JSON_EXTRACT` back as JSON — quoted, with a newline as
     * `\n` — so they need `JSON_UNQUOTE`, or a search for a quote or a line
     * break finds nothing (`bin/verify-lead-search.php`). SQLite has no
     * `JSON_UNQUOTE`, and its `JSON_EXTRACT` already returns the plain text.
     * Elsewhere bare `JSON_EXTRACT` is read and unquoted in PHP
     * ({@see \WConvert\Optin\OptinRepository}); a `WHERE` cannot do that.
     *
     * @return literal-string
     */
    public static function searchClause(bool $sqlite): string
    {
        return $sqlite
            ? ' AND (LOWER(email) LIKE LOWER(%s) OR phone LIKE %s OR LOWER(JSON_EXTRACT(fields, \'$.answers.name\')) LIKE LOWER(%s) OR LOWER(JSON_EXTRACT(fields, \'$.answers.message\')) LIKE LOWER(%s))'
            : ' AND (LOWER(email) LIKE LOWER(%s) OR phone LIKE %s OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(fields, \'$.answers.name\'))) LIKE LOWER(%s) OR LOWER(JSON_UNQUOTE(JSON_EXTRACT(fields, \'$.answers.message\'))) LIKE LOWER(%s))';
    }

    /** The SQLite Database Integration (Playground, some hosts) declares itself here. */
    private static function onSqlite(): bool
    {
        return defined('DB_ENGINE') && DB_ENGINE === 'sqlite';
    }

    /**
     * @param list<string>|null $purposeOptins All matching IDs, including historical Campaigns.
     * @return array{sql: literal-string, params: list<string>}
     */
    public function constraints(?array $purposeOptins = null): array
    {
        $filter = $this->filters($purposeOptins);
        if ($this->snapshot !== '') { $filter['sql'] .= ' AND id < %s'; $filter['params'][] = $this->snapshot; }

        return $filter;
    }

    /** The first Lead id of a site-timezone day, as a primary-key bound (ADR 0033). */
    public static function dayStart(string $date): string
    {
        return Ulid::floorAt(max(0, self::date($date)->getTimestamp() * 1000));
    }

    /** The first Lead id after a site-timezone day: the exclusive upper bound. */
    public static function dayEnd(string $date): string
    {
        return Ulid::floorAt(max(0, self::date($date)->modify('+1 day')->getTimestamp() * 1000));
    }

    /**
     * @param list<string>|null $purposeOptins
     * @return array{sql: literal-string, params: list<string>}
     */
    private function filters(?array $purposeOptins): array
    {
        $sql = '1 = 1';
        $params = [];
        if ($this->search !== null) {
            // Literal substring search is explicit, never run on each keystroke.
            // JSON values (not keys or consent text) are searched as captured.
            $sql .= self::searchClause(self::onSqlite());
            $term = '%' . addcslashes($this->search, '_%\\') . '%';
            $params = [$term, $term, $term, $term];
        }
        if ($this->purpose !== null) {
            if ($purposeOptins === null) throw new \LogicException('Resolve the submission purpose before reading.');
            if ($purposeOptins === []) $sql .= ' AND 1 = 0';
            else {
                $sql .= ' AND optin_id IN (';
                foreach ($purposeOptins as $index => $id) {
                    $sql .= $index === 0 ? '%s' : ', %s';
                    $params[] = $id;
                }
                $sql .= ')';
            }
        }
        if ($this->optinId !== null) { $sql .= ' AND optin_id = %s'; $params[] = $this->optinId; }
        if ($this->leadId !== null) { $sql .= ' AND id = %s'; $params[] = $this->leadId; }
        if ($this->identifier !== null) {
            $sql .= str_contains($this->identifier, '@') ? ' AND email = %s' : ' AND phone = %s';
            $params[] = $this->identifier;
        }
        if ($this->groupIdentifier !== null) {
            $sql .= str_contains($this->groupIdentifier, '@') ? ' AND email = %s' : ' AND email IS NULL AND phone = %s';
            $params[] = $this->groupIdentifier;
        }
        if ($this->from !== null) {
            $sql .= ' AND id >= %s';
            $params[] = self::dayStart($this->from);
        }
        if ($this->to !== null) {
            $sql .= ' AND id < %s';
            $params[] = self::dayEnd($this->to);
        }

        return ['sql' => $sql, 'params' => $params];
    }

    private static function date(string $date): DateTimeImmutable
    {
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, wp_timezone());
        if ($parsed === false || $parsed->format('Y-m-d') !== $date) {
            throw new InvalidArgumentException(__('Enter a valid date in YYYY-MM-DD format.', 'wconvert'));
        }
        return $parsed;
    }
    // phpcs:enable WordPress.Security.EscapeOutput.ExceptionNotEscaped
}

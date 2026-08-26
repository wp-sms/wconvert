<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Destination\Wsms\ContactConflict;
use WConvert\Destination\Wsms\WsmsContacts;

/**
 * An in-memory WSMS contact table — **with its two unique indexes**.
 *
 * The indexes are the whole reason this is a fake rather than a stub. WSMS's
 * `wsms_contacts` carries `idx_email` and `idx_phone`, and
 * `ContactRepository::duplicateContact()` turns either violation into a
 * `ConflictException`. The both-identifiers case — email matching Contact A,
 * phone matching Contact B — is a collision that HAPPENS rather than one a
 * test stages, and a fake that ignored the indexes would let the adapter's
 * conflict branch pass without ever running (ADR 0022).
 *
 * It records `created` and `updated` in order, so a test can assert not just
 * the resulting rows but what was ASKED of WSMS — which is where
 * fill-empty-only lives: a stored value is untouched because it was never in
 * the patch, not because the write happened to be a no-op.
 */
final class FakeWsmsContacts implements WsmsContacts
{
    /** @var array<string, array<string, mixed>> Contact rows by id. */
    public array $contacts = [];

    /** @var list<array<string, mixed>> Every create, in order. */
    public array $created = [];

    /** @var list<array{id: string, data: array<string, mixed>}> Every update, in order. */
    public array $updated = [];

    /** @var list<array{contact: string, tag: string}> Every addTag, in order. */
    public array $tagged = [];

    /** @var list<string> Failures to raise, one per create/update call, in order. `''` means "no failure". */
    public array $failures = [];

    /**
     * @var array<string, array<string, mixed>> Rows that land the instant
     *      {@see self::create()} is called — another writer arriving between
     *      our read and our write. It is the only way to stage a conflict on
     *      CREATE, since a row seeded up front would simply be matched.
     */
    public array $raceOnCreate = [];

    /**
     * @var list<string> Conflicts to raise, one per create call, in order.
     *      `''` means "no conflict". Unlike {@see self::$raceOnCreate} this
     *      seeds NO row, so the read that follows finds nothing and the
     *      conflict is unresolvable — the one branch that reaches
     *      {@see \WConvert\Destination\Wsms\UnresolvableConflict}.
     */
    public array $createConflicts = [];

    /** @var list<string> Failures to raise, one per addTag call, in order. `''` means "no failure". */
    public array $tagFailures = [];

    private int $nextId = 1;

    /**
     * Seed a Contact as WSMS already holds it.
     *
     * @param array<string, mixed> $row
     */
    public function seed(string $id, array $row): void
    {
        $this->contacts[$id] = $row + ['id' => $id];
    }

    public function findByEmail(string $email): ?array
    {
        foreach ($this->contacts as $contact) {
            if (($contact['email'] ?? null) === $email) {
                return $contact;
            }
        }

        return null;
    }

    public function findByPhone(string $phone): ?array
    {
        foreach ($this->contacts as $contact) {
            if (($contact['phone'] ?? null) === $phone) {
                return $contact;
            }
        }

        return null;
    }

    public function create(array $contact): string
    {
        $this->raiseNextFailure();

        if ($this->createConflicts !== []) {
            $conflict = array_shift($this->createConflicts);

            if ($conflict !== '') {
                throw new ContactConflict($conflict);
            }
        }

        $this->created[] = $contact;

        foreach ($this->raceOnCreate as $id => $row) {
            $this->contacts[$id] = $row + ['id' => $id];
        }

        $this->raceOnCreate = [];

        $this->assertFree('email', $contact['email'] ?? null, null);
        $this->assertFree('phone', $contact['phone'] ?? null, null);

        $id = 'contact-' . $this->nextId++;
        $this->contacts[$id] = $contact + ['id' => $id];

        return $id;
    }

    public function update(string $contactId, array $contact): void
    {
        $this->raiseNextFailure();

        $this->updated[] = ['id' => $contactId, 'data' => $contact];

        $this->assertFree('email', $contact['email'] ?? null, $contactId);
        $this->assertFree('phone', $contact['phone'] ?? null, $contactId);

        $this->contacts[$contactId] = $contact + ($this->contacts[$contactId] ?? ['id' => $contactId]);
    }

    public function addTag(string $contactId, string $tagId): void
    {
        if ($this->tagFailures !== []) {
            $failure = array_shift($this->tagFailures);

            if ($failure !== '') {
                throw new \RuntimeException($failure);
            }
        }

        $this->tagged[] = ['contact' => $contactId, 'tag' => $tagId];
    }

    /**
     * The next queued failure, if a test asked for one — an empty string means
     * this call succeeds. Anything else is thrown as a transport failure,
     * which is how a partially-completed multi-call sequence is staged.
     */
    private function raiseNextFailure(): void
    {
        if ($this->failures === []) {
            return;
        }

        $failure = array_shift($this->failures);

        if ($failure !== '') {
            throw new \RuntimeException($failure);
        }
    }

    /**
     * `idx_email` / `idx_phone`, enforced.
     *
     * @param mixed $value
     */
    private function assertFree(string $column, $value, ?string $exceptId): void
    {
        if ($value === null || $value === '') {
            return;
        }

        foreach ($this->contacts as $id => $contact) {
            if ($id !== $exceptId && ($contact[$column] ?? null) === $value) {
                throw new ContactConflict(sprintf('A contact with this %s already exists.', $column));
            }
        }
    }
}

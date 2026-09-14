<?php

namespace WConvert\Destination\Wsms;

use WConvert\Destination\CanonicalFields;
use WConvert\Destination\DestinationType;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushResult;
use WConvert\Destination\PushSubject;
use WConvert\Support\SiteDependency;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * The WSMS push — the free tier's one integrated [[Destination]].
 *
 * @since 0.1.0
 */
final class WsmsDestinationType implements DestinationType
{
    public const ID = 'wsms';

    /** Canonical key => WSMS column. The whole field map, once, for every Optin (#4). */
    private const COLUMNS = [
        CanonicalFields::EMAIL => 'email',
        CanonicalFields::PHONE => 'phone',
        CanonicalFields::NAME => 'first_name',
    ];

    public function __construct(
        private readonly WsmsContacts $contacts,
    ) {
    }

    public function id(): string
    {
        return self::ID;
    }

    public function label(): string
    {
        return __('WP SMS contacts', 'wconvert');
    }

    public function icon(): string
    {
        return 'users';
    }

    public function tier(): Tier
    {
        return Tier::Free;
    }

    /**
     * WSMS, always. The return type is narrower than the interface's on
     * purpose: this type is meaningless without it, and a `null` here would be
     * a Destination that claims to need nothing while calling into a plugin
     * that may not be there.
     */
    public function requires(): SiteDependency
    {
        return SiteDependency::Wsms;
    }

    /**
     * None. It is an in-process PHP call and authenticates against nothing.
     */
    public function connectionSchema(): ?array
    {
        return null;
    }

    /**
     * One field: the tags to add.
     *
     * **Tags, not lists** — `wsms_lists` is a segment definition whose
     * membership is a query, so there is nothing to insert into (ADR 0023).
     *
     * The options are NOT read off the wire here, which is the one place this
     * type differs from every ESP: WSMS is in-process, so the admin can read
     * its tags itself, and pulling them through this method would put a
     * database query on a REST read that is otherwise pure configuration. The
     * method still earns its place — it is what tells the admin the field
     * exists at all, which is what collapses the `Supports*` split (#4).
     *
     * @param array<string, mixed> $credentials
     * @return array<string, mixed>
     */
    public function settingsSchema(array $credentials): array
    {
        unset($credentials);

        return [
            'tags' => [
                'type' => 'ids',
                'label' => __('Tags to add', 'wconvert'),
                'description' => __(
                    'Added to the contact, never removed — a tag WConvert did not set is not WConvert’s to take away.',
                    'wconvert'
                ),
            ],
        ];
    }

    /**
     * @param array<string, mixed> $credentials
     */
    public function testConnection(array $credentials): void
    {
        unset($credentials);
    }

    public function push(PushSubject $subject, PushContext $context): PushResult
    {
        $values = $subject->values;

        // WSMS's `create()` hard-requires one of the two identifiers, so a
        // Lead carrying neither has nothing to send. **Skipped, not failed**:
        // it is a routine outcome and it must stay out of the health count
        // (ADR 0008). The capture path refuses such a Lead while the visitor
        // is still on the page, so nothing a form can do reaches this.
        if (!$this->requirements()->acceptsCapture($values)) {
            return PushResult::skipped('The Lead carries neither an email nor a phone.');
        }

        try {
            $match = $this->match($values);

            $contactId = $match === null
                ? $this->create($values, $context)
                : $this->fillBlanks((string) ($match['id'] ?? ''), $match, $values);

            $this->applyTags($contactId, $context);
        } catch (\Throwable $failure) {
            // **Retryable, always.** WSMS is in-process, so there is no HTTP
            // status to misread and nothing here is a Lead-specific rejection:
            // an unparseable identifier was refused at capture (ADR 0021) and
            // a duplicate is caught above as success-with-existing. What is
            // left is WSMS being broken or absent, which is an outage — and
            // re-running the whole of `push()` is what fixes it, because
            // `push()` is idempotent (ADR 0008). {@see UnresolvableConflict}
            // arrives here too, and is the same answer for the same reason.
            return PushResult::retryable($failure->getMessage());
        }

        return PushResult::success($contactId);
    }

    public function requirements(): DestinationRequirements
    {
        return new DestinationRequirements(['email', 'phone'], [], ['email', 'phone', 'name'], audienceChannels: ['email', 'phone']);
    }

    public function throughput(): int
    {
        return 60;
    }

    /**
     * **Email first**, then phone.
     *
     * @param array<string, string> $values
     * @return array<string, mixed>|null
     */
    private function match(array $values): ?array
    {
        $byEmail = isset($values[CanonicalFields::EMAIL])
            ? $this->contacts->findByEmail($values[CanonicalFields::EMAIL])
            : null;

        if ($byEmail !== null) {
            return $byEmail;
        }

        return isset($values[CanonicalFields::PHONE])
            ? $this->contacts->findByPhone($values[CanonicalFields::PHONE])
            : null;
    }

    /**
     * A Contact WSMS has never heard of.
     *
     * `status` is `subscribed` and nothing else (ADR 0016). The visitor typed
     * their address into a form whose consent copy said what it was for, which
     * is the same evidence WSMS's own single-opt-in forms act on — and the
     * asymmetry with a MATCHED Contact is the model rather than an
     * inconsistency: creating is a claim about someone the owning system has
     * never heard of, where the form is the only evidence in existence.
     *
     * **Provenance rides along.** `source` and `source_ref` are filterable,
     * segmentable and rendered in WSMS, so provenance lands in the system that
     * owns the concept and WConvert stores nothing about it. Leaving them
     * unset is the actively bad option — the default is `'manual'`, which
     * makes every pushed Lead look hand-typed (ADR 0023).
     *
     * `custom_fields` is not here and is never written. A canonical-key to
     * custom-field mapping is a second field map, and #4 removed the first one
     * on purpose.
     *
     * @param array<string, string> $values
     */
    private function create(array $values, PushContext $context): string
    {
        try {
            return $this->contacts->create($this->newContact($values, $context));
        } catch (ContactConflict $taken) {
            // Another writer landed the row between our read and our write.
            // It is the both-identifiers resolution one call earlier, and it
            // takes the same answer: **success with existing**, nothing
            // merged. It is also what a retry of a partially-completed
            // sequence walks into, which is why `push()` is idempotent by
            // construction rather than by a flag (ADR 0008).
            $existing = $this->match($values);

            if ($existing === null) {
                // The index says the identifier is taken and no read can find
                // the Contact holding it. Nothing here can resolve that, and a
                // retry is free — `push()` is idempotent — so this is the one
                // shape of conflict that goes back on the queue.
                // Unescaped, for the reason {@see WpWsmsContacts::call()}
                // spells out where WSMS's text enters: this message ends up in
                // `PushResult::reason` and is stored, not printed.
                // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- caught by push() below and stored as operator text; see WpWsmsContacts::call().
                throw new UnresolvableConflict($taken->getMessage());
            }

            return (string) ($existing['id'] ?? '');
        }
    }

    /**
     * @param array<string, string> $values
     * @return array<string, mixed>
     */
    private function newContact(array $values, PushContext $context): array
    {
        $contact = ['status' => 'subscribed', 'source' => 'wconvert'];

        // Set only where there is a name to set. WSMS's own default for
        // `source_ref` is null, and an empty string here would read as
        // provenance that was recorded and came back blank.
        if ($context->optinName !== null && $context->optinName !== '') {
            $contact['source_ref'] = $context->optinName;
        }

        foreach (self::COLUMNS as $canonical => $column) {
            if (isset($values[$canonical])) {
                $contact[$column] = $values[$canonical];
            }
        }

        return $contact;
    }

    /**
     * The Destination's tags, **added and never reconciled**.
     *
     * Tags rather than lists: `wsms_lists` is a segment DEFINITION — a
     * `conditions` JSON with `type` defaulting to `'dynamic'` — and membership
     * lives in `wsms_contact_tag`. A dynamic list is a query; there is nothing
     * to insert into (ADR 0023).
     */
    private function applyTags(string $contactId, PushContext $context): void
    {
        $tags = $context->settings['tags'] ?? [];

        foreach (is_array($tags) ? $tags : [] as $tag) {
            if (is_string($tag) && $tag !== '') {
                $this->contacts->addTag($contactId, $tag);
            }
        }
    }

    /**
     * The patch: only the columns this Contact left EMPTY.
     *
     * @param array<string, mixed>|null $contact
     * @param array<string, string> $values
     * @return array<string, mixed>
     */
    private function blanksIn(?array $contact, array $values): array
    {
        $patch = [];

        foreach (self::COLUMNS as $canonical => $column) {
            $stored = $contact[$column] ?? null;

            if (isset($values[$canonical]) && ($stored === null || $stored === '')) {
                $patch[$column] = $values[$canonical];
            }
        }

        return $patch;
    }

    /**
     * Fill what the matched Contact left empty, and nothing else.
     *
     * @param array<string, mixed> $match
     * @param array<string, string> $values
     * @return string The matched Contact's id, unchanged.
     */
    private function fillBlanks(string $contactId, array $match, array $values): string
    {
        $patch = $this->blanksIn($match, $values);

        if ($patch === []) {
            return $contactId;
        }

        try {
            $this->contacts->update($contactId, $patch);
        } catch (ContactConflict $taken) {
            // **The both-identifiers case.** The email matched Contact A and
            // the phone belongs to Contact B, so filling A's empty phone hits
            // `idx_phone`. First match wins, the second identifier is dropped,
            // and NOTHING IS MERGED — merging two Contacts is a lifecycle
            // operation and out of bounds by the same rule as the rest of
            // ADR 0022. The push succeeded: the person is in the book.
            unset($taken);
        }

        return $contactId;
    }
}

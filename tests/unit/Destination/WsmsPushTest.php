<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushOutcome;
use WConvert\Destination\PushSubject;
use WConvert\Destination\Wsms\WsmsDestinationType;
use WConvert\Lead\Lead;
use WConvert\Tests\Unit\Support\FakeWsmsContacts;

/**
 * The WSMS push, at the seam that matters: `push()` against a WSMS contact
 * table that enforces its own unique indexes.
 */
final class WsmsPushTest extends TestCase
{
    /**
     * @param array<string, string> $fields
     */
    private function subject(?string $email, ?string $phone, array $fields = []): PushSubject
    {
        return PushSubject::of(new Lead('01LEAD', '01OPTIN', $email, $phone, $fields, '2026-08-25 10:00:00'));
    }

    /**
     * @param array<string, mixed> $settings
     */
    private function context(array $settings = []): PushContext
    {
        return new PushContext('Welcome discount', $settings);
    }

    /**
     * The anonymous-submission threat model, and the whole of ADR 0022.
     *
     * The submission is unauthenticated and matched on ONE identifier, so
     * honouring it would let whoever knows an email rewrite the name beside
     * it. The tempting alternative — incoming-wins — is correct elsewhere in
     * WSMS's own codebase (`CreateContactAction::handleDuplicate()` with
     * `on_duplicate=update`), which is exactly why this test exists: it
     * records which caller we are.
     */
    public function testItFillsAnEmptyFieldAndNeverOverwritesAStoredOne(): void
    {
        $contacts = new FakeWsmsContacts();

        // Seeded under the column the adapter actually writes. The canonical
        // key is `name` and WSMS's column is `first_name`, and a fixture
        // seeded under the canonical spelling would leave the stored value in
        // a column nothing reads — so the assertion below would hold whatever
        // the adapter did with a name, which is the one thing this test exists
        // to pin down.
        $contacts->seed('c1', ['email' => 'sarah@example.com', 'phone' => null, 'first_name' => 'Sarah Stored']);

        $type = new WsmsDestinationType($contacts);

        $result = $type->push(
            $this->subject('sarah@example.com', '+447911123456', ['name' => 'Typo Sarah']),
            $this->context()
        );

        self::assertSame(PushOutcome::Success, $result->outcome);
        self::assertSame([], $contacts->created, 'A matched Contact is never created again.');

        self::assertCount(1, $contacts->updated);

        // The WHOLE patch, not a key probe: incoming-wins would add
        // `first_name` here, and an assertion that only names the keys it
        // expects to be absent cannot see a key it forgot to name.
        self::assertSame(['phone' => '+447911123456'], $contacts->updated[0]['data']);
        self::assertSame('Sarah Stored', $contacts->contacts['c1']['first_name'], 'The stored name is untouched.');
    }

    /**
     * `subscribed`, never `pending` (ADR 0016).
     *
     * `pending` looked conservative and is a dead end: nothing in WSMS can
     * move a WConvert-created Contact out of it — its only exit is
     * `SubscriptionHandler::verify()`, which needs a live form session a
     * queued push does not have — and campaign audiences filter on
     * `status = 'subscribed'`. Every pushed Lead would be permanently
     * invisible to every campaign, silently.
     */
    public function testItCreatesAContactAsSubscribedWithProvenance(): void
    {
        $contacts = new FakeWsmsContacts();
        $type = new WsmsDestinationType($contacts);

        $result = $type->push(
            $this->subject('new@example.com', null, ['name' => 'New Person']),
            $this->context(['tags' => ['tag-7', 'tag-9']])
        );

        self::assertSame(PushOutcome::Success, $result->outcome);
        self::assertCount(1, $contacts->created);

        $created = $contacts->created[0];
        self::assertSame('subscribed', $created['status']);
        self::assertSame('new@example.com', $created['email']);
        self::assertSame('New Person', $created['first_name']);

        // Not setting these is the actively bad option: WSMS defaults `source`
        // to 'manual', which makes every pushed Lead look hand-typed. The NAME
        // rather than the id, because WSMS can never resolve a WConvert ULID
        // (ADR 0023).
        self::assertSame('wconvert', $created['source']);
        self::assertSame('Welcome discount', $created['source_ref']);

        self::assertSame(
            [['contact' => $result->providerRef, 'tag' => 'tag-7'], ['contact' => $result->providerRef, 'tag' => 'tag-9']],
            $contacts->tagged
        );
    }

    /**
     * A matched Contact keeps whatever state it had — and "never writes
     * `status`" is absolute because refusing costs nothing: WSMS gates at SEND
     * time, so an unsubscriber who converts on a popup is protected by whoever
     * sends. Asserting `subscribed` would be a silent cross-plugin
     * resurrection (ADR 0022).
     */
    public function testItWritesNoLifecycleStateOnAMatch(): void
    {
        $contacts = new FakeWsmsContacts();
        $contacts->seed('c1', [
            'email' => 'left@example.com',
            'phone' => null,
            'first_name' => null,
            'status' => 'complained',
            'channel_opt_outs' => ['email' => '2026-01-01 00:00:00'],
            'custom_fields' => ['plan' => 'gold'],
        ]);

        $type = new WsmsDestinationType($contacts);

        $type->push($this->subject('left@example.com', null, ['name' => 'Still Here']), $this->context());

        $patch = $contacts->updated[0]['data'];

        self::assertSame(['first_name' => 'Still Here'], $patch);
        self::assertSame('complained', $contacts->contacts['c1']['status']);
        self::assertSame(['plan' => 'gold'], $contacts->contacts['c1']['custom_fields']);
    }

    /**
     * One submission carrying an email that matches Contact A and a phone that
     * matches Contact B.
     *
     * Match order is email-then-phone, so **A wins**. Filling A's empty phone
     * then collides with `idx_phone`, and the adapter treats the conflict as
     * **success-with-existing**: first match wins, the second identifier is
     * dropped, and **nothing is merged**. Merging two Contacts is a lifecycle
     * operation and out of bounds by the same rule as the rest of ADR 0022.
     */
    public function testTheBothIdentifiersConflictResolvesAsSuccessWithExisting(): void
    {
        $contacts = new FakeWsmsContacts();
        $contacts->seed('A', ['email' => 'sarah@example.com', 'phone' => null, 'first_name' => null]);
        $contacts->seed('B', ['email' => null, 'phone' => '+447911123456', 'first_name' => 'Other Sarah']);

        $type = new WsmsDestinationType($contacts);

        $result = $type->push(
            $this->subject('sarah@example.com', '+447911123456', ['name' => 'Sarah']),
            $this->context(['tags' => ['tag-7']])
        );

        self::assertSame(PushOutcome::Success, $result->outcome);
        self::assertSame('A', $result->providerRef, 'First match wins.');

        // Nothing merged, in both directions: B keeps its phone and its name,
        // and A did not acquire B's.
        self::assertSame('+447911123456', $contacts->contacts['B']['phone']);
        self::assertSame('Other Sarah', $contacts->contacts['B']['first_name']);
        self::assertNull($contacts->contacts['A']['phone']);

        // The push still SUCCEEDED, so the tag lands on the Contact that won.
        self::assertSame([['contact' => 'A', 'tag' => 'tag-7']], $contacts->tagged);
    }

    /**
     * The same resolution one call earlier: a Lead that matched nothing, whose
     * `create()` collides because another writer landed the row between our
     * read and our write. It is the identical situation and takes the
     * identical answer — and it is also what makes a retry of a
     * partially-completed sequence safe.
     */
    public function testACreateConflictIsAlsoSuccessWithExisting(): void
    {
        $contacts = new FakeWsmsContacts();
        $contacts->raceOnCreate = ['existing' => ['email' => 'race@example.com', 'phone' => null]];

        $type = new WsmsDestinationType($contacts);

        $result = $type->push($this->subject('race@example.com', null), $this->context(['tags' => ['tag-7']]));

        self::assertSame(PushOutcome::Success, $result->outcome);
        self::assertSame('existing', $result->providerRef);
        self::assertSame([['contact' => 'existing', 'tag' => 'tag-7']], $contacts->tagged);
    }

    /**
     * **Idempotency, across a retry of a partially-completed sequence.**
     *
     * `push()` is not one call: it creates a [[Contact]] and then tags it. A
     * retry therefore re-runs a sequence that is already half done, and no
     * vendor offers an idempotency header — so every implementation keys on
     * the vendor's own identifier-keyed upsert, and this is the test that
     * says so. Everything downstream stands on it: retries, bulk re-push, and
     * the `wconvert_lead_deliveries` table that was NOT built because
     * re-pushing a landed Lead is harmless (ADR 0008).
     */
    public function testARetryOfAPartiallyCompletedSequenceLeavesOneContact(): void
    {
        $contacts = new FakeWsmsContacts();
        $type = new WsmsDestinationType($contacts);
        $subject = $this->subject('sarah@example.com', null, ['name' => 'Sarah']);

        // The Contact lands, and the sequence dies before its tag does.
        $contacts->tagFailures = ['WSMS went away'];

        $first = $type->push($subject, $this->context(['tags' => ['tag-7']]));

        self::assertSame(PushOutcome::Failed, $first->outcome);
        self::assertTrue($first->retryable);
        self::assertCount(1, $contacts->contacts);

        // The retry re-runs the WHOLE of push(), which is exactly what makes
        // the flag safe to set.
        $second = $type->push($subject, $this->context(['tags' => ['tag-7']]));

        self::assertSame(PushOutcome::Success, $second->outcome);
        self::assertCount(1, $contacts->contacts, 'Two pushes, one Contact.');
        self::assertCount(1, $contacts->created, 'The second push matched rather than created.');
        self::assertSame([], $contacts->updated, 'Nothing was blank the second time, so nothing was written.');
        self::assertSame([['contact' => 'contact-1', 'tag' => 'tag-7']], $contacts->tagged);
    }

    /**
     * A [[Lead]] with nothing to send is **skipped, not failed** — and the
     * difference is what keeps a routine outcome out of
     * {@see \WConvert\Destination\DestinationHealth}'s failure count
     * (ADR 0008).
     *
     * WSMS's `ContactRepository::create()` hard-requires one of the two
     * identifiers, so this is what pushing a Lead carrying neither has to
     * mean. The capture path refuses such a Lead while the visitor is still on
     * the page (ADR 0021), so this is the branch that holds when something
     * else changes — not one a form can reach.
     */
    public function testALeadWithNoIdentifierIsSkippedRatherThanFailed(): void
    {
        $contacts = new FakeWsmsContacts();
        $type = new WsmsDestinationType($contacts);

        $result = $type->push($this->subject(null, null, ['name' => 'Nobody']), $this->context());

        self::assertSame(PushOutcome::Skipped, $result->outcome);
        self::assertFalse($result->isFailure());
        self::assertSame([], $contacts->created);
    }

    /**
     * WSMS disclaiming back-compatibility is why the whole coupling is five
     * methods behind one interface — and why a throw from inside it must
     * become a queued retry rather than an uncaught fatal in a job.
     */
    public function testAThrowFromWsmsBecomesARetryableFailure(): void
    {
        $contacts = new FakeWsmsContacts();
        $contacts->failures = ['Call to undefined method'];

        $type = new WsmsDestinationType($contacts);

        $result = $type->push($this->subject('sarah@example.com', null), $this->context());

        self::assertSame(PushOutcome::Failed, $result->outcome);
        self::assertTrue($result->retryable);
    }

    /**
     * ========================================================================
     * WSMS'S MESSAGE ARRIVES VERBATIM, ON BOTH ROUTES OUT.
     * ========================================================================
     * `reason` is not a page. {@see \WConvert\Destination\PushWorker} hands it
     * to {@see \WConvert\Destination\HealthStore::failed()} and to
     * {@see \WConvert\Destination\DeliveryFailures::record()}, which store it
     * for an operator to read — and the admin renders it through React, which
     * escapes on the way to the DOM.
     *
     * So HTML-escaping it anywhere on the way is corruption and not safety:
     * `&#039;` is what an operator would read instead of an apostrophe, and
     * `DeliveryFailures` truncates with `mb_substr()`, which will happily cut
     * an entity in half. This is the assertion that says so, and it holds the
     * `phpcs:ignore` in {@see \WConvert\Destination\Wsms\WpWsmsContacts::call()}
     * up (#60) — an escape added to satisfy the sniff fails here.
     *
     * Both routes, because they escape through different exceptions: an
     * ordinary throw rides `catch (\Throwable)`, and an unresolvable conflict
     * is re-thrown as {@see \WConvert\Destination\Wsms\UnresolvableConflict}
     * one frame down.
     */
    public function testWsmsFailureTextIsStoredExactlyAsWsmsWroteIt(): void
    {
        $message = "Sarah's contact & the <list> it's on couldn't be reached";

        $contacts = new FakeWsmsContacts();
        $contacts->failures = [$message];

        $ordinary = (new WsmsDestinationType($contacts))
            ->push($this->subject('sarah@example.com', null), $this->context());

        self::assertSame($message, $ordinary->reason, 'an ordinary WSMS throw was rewritten on the way out');

        // The index says the identifier is taken and no read can find the
        // Contact holding it — the one conflict that is not success-with-
        // existing, and the only path through UnresolvableConflict.
        $raced = new FakeWsmsContacts();
        $raced->createConflicts = [$message];

        $unresolvable = (new WsmsDestinationType($raced))
            ->push($this->subject('sarah@example.com', null), $this->context());

        self::assertSame(PushOutcome::Failed, $unresolvable->outcome);
        self::assertTrue($unresolvable->retryable);
        self::assertSame($message, $unresolvable->reason, 'an unresolvable conflict was rewritten on the way out');
    }
}

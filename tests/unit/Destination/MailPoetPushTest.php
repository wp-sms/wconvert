<?php

namespace WConvert\Tests\Unit\Destination;

use PHPUnit\Framework\TestCase;
use WConvert\Destination\MailPoet\MailPoetDestinationType;
use WConvert\Destination\MailPoet\WpMailPoetSubscribers;
use WConvert\Destination\PushContext;
use WConvert\Destination\PushOutcome;
use WConvert\Destination\PushSubject;
use WConvert\Lead\Lead;
use WConvert\Tests\Unit\Support\FakeMailPoetSubscribers;

/**
 * The MailPoet push, at the seam that matters: `push()` against a MailPoet
 * that enforces its unique index on email and holds a status on every
 * membership row.
 */
final class MailPoetPushTest extends TestCase
{
    /**
     * @param array<string, string> $fields
     */
    private function subject(?string $email, array $fields = []): PushSubject
    {
        return PushSubject::of(new Lead('01LEAD', '01OPTIN', $email, null, $fields, '2026-08-25 10:00:00'));
    }

    /**
     * @param list<string> $lists
     */
    private function context(array $lists = ['3']): PushContext
    {
        return new PushContext('Welcome discount', [MailPoetDestinationType::LISTS => $lists]);
    }

    /**
     * The tracer bullet: an address MailPoet has never seen becomes one
     * subscriber, on the configured list.
     *
     * The name lands **whole and unsplit** in `first_name`, for the reason
     * ADR 0022 gives about WSMS's identical pair: splitting on a space files
     * "van der Berg" and "Maria Elena" wrong in opposite directions, and the
     * wrong half then becomes a stored value nothing corrects.
     */
    public function testANewAddressBecomesOneSubscriberOnTheConfiguredList(): void
    {
        $subscribers = new FakeMailPoetSubscribers();
        $type = new MailPoetDestinationType($subscribers);

        $result = $type->push($this->subject('new@example.com', ['name' => 'New Person']), $this->context());

        self::assertSame(PushOutcome::Success, $result->outcome);
        self::assertCount(1, $subscribers->added);

        self::assertSame(
            ['email' => 'new@example.com', 'first_name' => 'New Person'],
            $subscribers->added[0]['subscriber']
        );
        self::assertSame(['3'], $subscribers->added[0]['lists']);
        self::assertSame(['3' => 'subscribed'], $subscribers->memberships[$result->providerRef]);
    }

    /**
     * **Idempotency, across a retry of a partially-completed push.**
     *
     * `push()` is not one call: it matches, then it creates or joins. A retry
     * therefore re-runs a sequence that is already half done, and MailPoet
     * offers no idempotency header — so this keys on MailPoet's own unique
     * index on email, and this is the test that says so. Everything downstream
     * stands on it: retries, bulk re-push, and the `wconvert_lead_deliveries`
     * table that was NOT built because re-pushing a landed Lead is harmless
     * (ADR 0008).
     *
     * The sequence is staged as MailPoet really breaks it — the subscriber
     * lands and `subscribeToLists()` throws on its way past, which is what
     * `APIException::CONFIRMATION_FAILED_TO_SEND` is — so the retry meets an
     * address the index already holds and a list it is not on.
     */
    public function testARetryOfAPartiallyCompletedPushLeavesOneSubscriberAndOneMembership(): void
    {
        $subscribers = new FakeMailPoetSubscribers();
        $type = new MailPoetDestinationType($subscribers);
        $subject = $this->subject('sarah@example.com', ['name' => 'Sarah']);

        // The subscriber lands, and the sequence dies before the list does.
        $subscribers->raceOnAdd = ['half-done' => ['email' => 'sarah@example.com', 'status' => 'unconfirmed']];

        $first = $type->push($subject, $this->context());

        self::assertSame(PushOutcome::Success, $first->outcome, 'The row is already there; that is not a failure.');
        self::assertSame('half-done', $first->providerRef);
        self::assertSame(['3' => 'subscribed'], $subscribers->memberships['half-done']);

        // The retry re-runs the WHOLE of push(), which is what makes putting
        // the job back on the queue safe.
        $second = $type->push($subject, $this->context());

        self::assertSame(PushOutcome::Success, $second->outcome);
        self::assertCount(1, $subscribers->subscribers, 'Two pushes, one subscriber.');
        self::assertSame(['3' => 'subscribed'], $subscribers->memberships['half-done']);
        self::assertCount(1, $subscribers->joined, 'The second push found the list already there and wrote nothing.');
    }

    /**
     * ========================================================================
     * THE NEVER-MUTATE RULE, AT BOTH SCOPES.
     * ========================================================================
     * Someone who unsubscribed, and who then converts on a popup. The owning
     * system already holds an opinion about that person — including the
     * opinion that they left — and **the owner's opinion wins** (ADR 0022).
     *
     * Refusing to write it costs nothing, because MailPoet gates at SEND time:
     * an unsubscribed subscriber receives nothing whatever a membership row
     * says. Asserting `subscribed` would instead be a silent resurrection,
     * invisible in both admin screens until a complaint arrives — the worst
     * failure available in this area.
     *
     * **The list scope is the half MailPoet adds**, and it is the one this
     * test can genuinely fail on: `mailpoet_subscriber_segment` carries a
     * status per row, so *"unsubscribe me from Offers, keep me on News"* is a
     * stored opinion, and MailPoet's own `createOrUpdate()` — which
     * {@see FakeMailPoetSubscribers::join()} models faithfully — would
     * overwrite it. The push hands `join()` only the lists MailPoet holds no
     * row for at all.
     *
     * The GLOBAL scope is held by the shape of the seam rather than by this
     * assertion: {@see \WConvert\Destination\MailPoet\MailPoetSubscribers}
     * offers no way to read a status and no way to write one. That the real
     * adapter picks MailPoet's status-preserving call is asserted in
     * {@see \WConvert\Tests\Unit\Contract\TheFreeCapturePathStaysInProcessTest}
     * and on a real WordPress in `bin/verify-destinations.php`, because no
     * fake can see which method another plugin's API was asked for.
     */
    public function testAnUnsubscribedSubscriberKeepsTheirStateAndGainsOnlyTheListTheyAreNotOn(): void
    {
        $subscribers = new FakeMailPoetSubscribers();
        $subscribers->seed(
            'left',
            ['email' => 'left@example.com', 'first_name' => 'Stored Name', 'status' => 'unsubscribed'],
            // They are on News, and they took themselves off Offers.
            ['3' => 'subscribed', '4' => 'unsubscribed']
        );

        $type = new MailPoetDestinationType($subscribers);

        $result = $type->push(
            $this->subject('left@example.com', ['name' => 'Typo Name']),
            $this->context(['3', '4', '5'])
        );

        self::assertSame(PushOutcome::Success, $result->outcome);
        self::assertSame('left', $result->providerRef);
        self::assertSame([], $subscribers->added, 'A matched subscriber is never created again.');

        // The WHOLE argument list, not a key probe: handing join() a list it
        // already holds a row for is exactly the mistake, and an assertion
        // that only named the rows it expected to be unchanged could not see
        // a list somebody added to the call.
        self::assertSame([['subscriber' => 'left', 'lists' => ['5']]], $subscribers->joined);

        self::assertSame(
            ['3' => 'subscribed', '4' => 'unsubscribed', '5' => 'subscribed'],
            $subscribers->memberships['left'],
            'The list they left is still left; only the one with no row at all was added.'
        );

        // Nothing about the person changed — not their status, and not the
        // name they or the merchant already corrected.
        self::assertSame('unsubscribed', $subscribers->subscribers['left']['status']);
        self::assertSame('Stored Name', $subscribers->subscribers['left']['first_name']);
    }

    /**
     * A [[Lead]] MailPoet has nowhere to put is **skipped, not failed** — and
     * the difference is what keeps a routine outcome out of
     * {@see \WConvert\Destination\DestinationHealth}'s failure count
     * (ADR 0008).
     *
     * MailPoet is an email tool with no column for a phone number, so a
     * phone-only [[Optin]] bound to it captures a Lead the local log keeps and
     * this Destination has nothing to send. The capture path refuses a Lead
     * with neither identifier while the visitor is still on the page
     * (ADR 0021), so this is the branch that holds when a merchant binds the
     * wrong Destination — not one a form can reach.
     */
    public function testALeadWithNoEmailIsSkippedRatherThanFailed(): void
    {
        $subscribers = new FakeMailPoetSubscribers();

        $result = (new MailPoetDestinationType($subscribers))
            ->push($this->subject(null, ['name' => 'Nobody']), $this->context());

        self::assertSame(PushOutcome::Skipped, $result->outcome);
        self::assertFalse($result->isFailure());
        self::assertSame([], $subscribers->added);
    }

    /**
     * No list configured is **retryable**, which looks like the wrong answer
     * and is the same one the lead-magnet type gives for a missing file.
     *
     * ADR 0008's criterion is not "how bad is it" but **whose fault it is**,
     * and this is about the DESTINATION rather than about this Lead. A
     * merchant who published the [[Optin]] before finishing the setup gets
     * attempts spread over the backoff window and health saying *"N failures
     * in a row: no MailPoet list is configured"* on the one screen built to
     * tell them pushing is broken. Terminal would put those Leads in a ring
     * nothing prompts anyone to read.
     */
    public function testNoConfiguredListIsARetryableFailureAboutTheDestination(): void
    {
        $subscribers = new FakeMailPoetSubscribers();

        $result = (new MailPoetDestinationType($subscribers))
            ->push($this->subject('sarah@example.com'), $this->context([]));

        self::assertSame(PushOutcome::Failed, $result->outcome);
        self::assertTrue($result->retryable);
        self::assertSame([], $subscribers->added, 'Nothing is created for a Destination that names no list.');
    }

    /**
     * MailPoet disclaiming nothing in particular about its internals is why
     * the whole coupling is four methods behind one interface — and why a
     * throw from inside it must become a queued retry rather than an uncaught
     * fatal in a job.
     *
     * **Retryable, always.** MailPoet is in-process, so there is no HTTP
     * status to misread and nothing here is a Lead-specific rejection: an
     * unparseable address was refused at capture (ADR 0021) and a duplicate is
     * resolved as success-with-existing. What is left is MailPoet being broken
     * or gone, which is an outage — and re-running the whole of `push()` is
     * what fixes it, because `push()` is idempotent.
     *
     * Its message arrives **verbatim**, for the reason the WSMS pair
     * documents: `reason` is not a page. It is stored for an operator and
     * rendered through React, which escapes on the way to the DOM, so escaping
     * it here would be corruption rather than safety.
     */
    public function testAThrowFromMailPoetBecomesARetryableFailureCarryingItsOwnWords(): void
    {
        $message = "Sarah's list & the <segment> it's on couldn't be reached";

        $subscribers = new FakeMailPoetSubscribers();
        $subscribers->failures = [$message];

        $result = (new MailPoetDestinationType($subscribers))
            ->push($this->subject('sarah@example.com'), $this->context());

        self::assertSame(PushOutcome::Failed, $result->outcome);
        self::assertTrue($result->retryable);
        self::assertSame($message, $result->reason, 'MailPoet’s text was rewritten on the way out');
    }

    /**
     * The merchant chooses a list **by name**, and never by pasting a segment
     * id they would have to read off a URL.
     *
     * That is an admin-time read of the provider's SHAPE — a list of names
     * reveals nothing about any person — which is the read ADR 0007 permits
     * and expects, and the one place this type differs from the WSMS push,
     * whose tags the admin can read for itself.
     */
    public function testTheSettingsSchemaOffersTheSitesListsByName(): void
    {
        $subscribers = new FakeMailPoetSubscribers();
        $subscribers->lists = ['3' => 'Newsletter', '4' => 'Offers'];

        $schema = (new MailPoetDestinationType($subscribers))->settingsSchema([]);

        self::assertSame(
            [['value' => '3', 'label' => 'Newsletter'], ['value' => '4', 'label' => 'Offers']],
            $schema[MailPoetDestinationType::LISTS]['options']
        );
    }

    /**
     * **Skipped, never thrown on** — belt to the registry's braces, against
     * the REAL adapter.
     *
     * {@see \WConvert\Tests\Unit\Destination\StandaloneTest} holds the part
     * that matters: a type that is not `ready` is skipped and never enqueued,
     * so nothing normally arrives here at all. This is what happens if
     * something does — a plugin deactivated between enqueue and run — and the
     * answer has to be a queued retry rather than an uncaught fatal inside an
     * Action Scheduler job, which retries forever and says nothing.
     *
     * The unit suite has no MailPoet, so the adapter under test is looking at
     * exactly the site a merchant with no MailPoet has.
     */
    public function testAPushOnASiteWithNoMailPoetFailsRetryablyRatherThanFatally(): void
    {
        $result = (new MailPoetDestinationType(new WpMailPoetSubscribers()))
            ->push($this->subject('sarah@example.com'), $this->context());

        self::assertSame(PushOutcome::Failed, $result->outcome);
        self::assertTrue($result->retryable);
        self::assertSame('MailPoet is not loaded on this site.', $result->reason);
    }
    public function testMappedInterestUsesTheStableValueOnlyForANewSubscriber(): void
    {
        $subscribers = new FakeMailPoetSubscribers();
        $type = new MailPoetDestinationType($subscribers);
        $context = new PushContext('Enquiry', ['lists' => ['3']]);
        $first = $type->push(PushSubject::test(['email' => 'new@example.com', 'interest' => 'installation'], ['cf_7' => 'installation']), $context);
        self::assertSame(PushOutcome::Success, $first->outcome);
        self::assertSame('installation', $subscribers->added[0]['subscriber']['cf_7']);
        self::assertArrayNotHasKey('interest_label', $subscribers->added[0]['subscriber']);
        $type->push($this->subject('new@example.com', ['interest' => 'repairs']), $context);
        self::assertCount(1, $subscribers->added);
        self::assertSame('installation', $subscribers->subscribers[$first->providerRef]['cf_7']);
    }

    public function testInterestStaysLocalWithoutAMappingAndAnUnavailableMappingCannotWrite(): void
    {
        $subscribers = new FakeMailPoetSubscribers();
        $type = new MailPoetDestinationType($subscribers);
        $type->push($this->subject('unmapped@example.com', ['interest' => 'installation']), $this->context());
        self::assertSame(['email' => 'unmapped@example.com'], $subscribers->added[0]['subscriber']);
        $result = $type->push(PushSubject::test(['email' => 'mapped@example.com'], ['cf_999' => 'installation']),
            new PushContext('Enquiry', ['lists' => ['3']]));
        self::assertSame(PushOutcome::Failed, $result->outcome);
        self::assertTrue($result->retryable);
        self::assertCount(1, $subscribers->added);
    }

    public function testRequirementsMatchThePushForEmptyOrMalformedListSettings(): void
    {
        $type = new MailPoetDestinationType(new FakeMailPoetSubscribers());
        foreach ([[], ['  '], [3], '3'] as $lists) {
            self::assertSame(['lists'], $type->requirements()->missingSettings(['lists' => $lists]));
            $result = $type->push($this->subject('new@example.com'), new PushContext('Enquiry', ['lists' => $lists]));
            self::assertSame(PushOutcome::Failed, $result->outcome);
            self::assertTrue($result->retryable);
        }
        self::assertTrue($type->requirements()->acceptsCapture(['email' => 'new@example.com']));
        self::assertFalse($type->requirements()->acceptsCapture(['phone' => '+447700900000']));
        self::assertSame(['email', 'name'], $type->requirements()->fields);
    }

}
